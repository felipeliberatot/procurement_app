#!/usr/bin/env python3
"""Patch the analyzeBudget endpoint to add Serper web search."""

with open('server/routers.ts', 'r') as f:
    content = f.read()

# Find the start marker
start_marker = '    analyzeBudget: protectedProcedure'
end_marker = '        return analysis;\n      }),'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: Could not find analyzeBudget start")
    exit(1)

# Find the end marker after the start
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: Could not find analyzeBudget end")
    exit(1)

end_idx += len(end_marker)
print(f"Found block at positions {start_idx}-{end_idx}")
print(f"Block preview: {content[start_idx:start_idx+100]}...")

new_block = '''    analyzeBudget: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        budgetFileUrl: z.string().url(),
        requestDescription: z.string(),
        requestItems: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          unitPrice: z.number().nullable(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        // Fase 1: Extrair itens do PDF via LLM
        const extractionPrompt = `Você é um assistente especializado em leitura de documentos.
Leia o PDF do orçamento em anexo e extraia TODOS os itens listados.
Retorne APENAS um JSON com esta estrutura exata:
{"items":[{"name":"nome do item","quantity":1,"unitPrice":100.00,"totalPrice":100.00}],"supplier":"nome do fornecedor","totalBudget":1000.00}
Se algum campo não estiver visível, use null.`;

        const extractionContent: Message["content"] = [
          { type: "text", text: `Extraia os itens do orçamento para: "${input.requestDescription}"` },
          { type: "file_url", file_url: { url: input.budgetFileUrl, mime_type: "application/pdf" } },
        ];

        const extractionResponse = await invokeLLM({
          messages: [
            { role: "system", content: extractionPrompt },
            { role: "user", content: extractionContent },
          ],
          response_format: { type: "json_object" },
        });

        const extractedRaw = extractionResponse.choices[0].message.content;
        const extractedStr = typeof extractedRaw === "string" ? extractedRaw : JSON.stringify(extractedRaw);
        type ExtractedItem = { name: string; quantity: number; unitPrice: number | null; totalPrice: number | null };
        type Extracted = { items: ExtractedItem[]; supplier?: string; totalBudget?: number };
        let extracted: Extracted;
        try {
          extracted = JSON.parse(extractedStr) as Extracted;
        } catch {
          extracted = { items: input.requestItems?.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.unitPrice ? i.unitPrice * i.quantity : null })) ?? [] };
        }

        // Fase 2: Buscar preços reais no Google Shopping via Serper API
        const serperKey = ENV.serperApiKey;
        type WebPriceEntry = { min: number; max: number; avg: number; sources: Array<{ title: string; price: number; link: string; source: string }> };
        const webPrices: Record<string, WebPriceEntry> = {};

        if (serperKey && extracted.items.length > 0) {
          const searchPromises = extracted.items.slice(0, 8).map(async (item) => {
            try {
              const resp = await fetch("https://google.serper.dev/shopping", {
                method: "POST",
                headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
                body: JSON.stringify({ q: `${item.name} preço`, gl: "br", hl: "pt-br", num: 5 }),
              });
              if (!resp.ok) return;
              const data = await resp.json() as { shopping?: Array<{ title: string; price: string; link: string; source: string }> };
              const prices = (data.shopping ?? [])
                .map(r => ({ title: r.title, price: parseFloat((r.price ?? "").replace(/[R$\s.]/g, "").replace(",", ".")), link: r.link, source: r.source }))
                .filter(r => !isNaN(r.price) && r.price > 0);
              if (prices.length > 0) {
                const vals = prices.map(p => p.price);
                webPrices[item.name] = {
                  min: Math.min(...vals),
                  max: Math.max(...vals),
                  avg: vals.reduce((a, b) => a + b, 0) / vals.length,
                  sources: prices.slice(0, 3),
                };
              }
            } catch { /* ignore individual search errors */ }
          });
          await Promise.all(searchPromises);
        }

        // Fase 3: Gerar parecer com LLM usando preços reais do Google Shopping
        const hasWebPrices = Object.keys(webPrices).length > 0;
        const webPricesContext = hasWebPrices
          ? `\n\nPREÇOS REAIS DO GOOGLE SHOPPING (use como referência principal):\n${Object.entries(webPrices).map(([name, data]) =>
              `- ${name}: min R$ ${data.min.toFixed(2)}, max R$ ${data.max.toFixed(2)}, média R$ ${data.avg.toFixed(2)} | Fontes: ${data.sources.map(s => `${s.source} R$${s.price.toFixed(2)}`).join(", ")}`
            ).join("\n")}`
          : "";

        const systemPrompt = `Você é um especialista em compras e análise de orçamentos para o setor agrícola brasileiro.
${hasWebPrices ? "Use os PREÇOS REAIS DO GOOGLE SHOPPING fornecidos como referência principal." : "Use seu conhecimento de preços do mercado brasileiro (2024-2025)."}

Para cada item, classifique: ADEQUADO (±15%), ACIMA_DO_MERCADO (15-30% acima), MUITO_ACIMA (>30% acima), ABAIXO_DO_MERCADO (>15% abaixo).
Calcule a variação percentual e forneça justificativa técnica.
${hasWebPrices ? "Inclua as fontes de preço no campo 'sources' de cada item." : ""}

Retorne JSON:
{
  "items": [{"name":"","quantity":1,"unitPrice":0,"totalPrice":0,"marketPriceMin":0,"marketPriceMax":0,"variation":0,"status":"ADEQUADO","justification":"","sources":[{"title":"","price":0,"link":"","source":""}]}],
  "totalBudget":0,"totalMarketMin":0,"totalMarketMax":0,"overallVariation":0,
  "recommendation":"APROVADO","summary":"","alerts":[],"usedWebSearch":${str(hasWebPrices).lower()}
}`;

        const userText = `Orçamento: "${input.requestDescription}" | Fornecedor: ${extracted.supplier ?? "N/A"} | Total: R$ ${(extracted.totalBudget ?? 0).toFixed(2)}\n\nItens:\n${extracted.items.map(i => `- ${i.name}: ${i.quantity}x R$${(i.unitPrice ?? 0).toFixed(2)} = R$${(i.totalPrice ?? 0).toFixed(2)}`).join("\n")}${webPricesContext}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0].message.content;
        const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const analysis = JSON.parse(contentStr);
        analysis.usedWebSearch = hasWebPrices;

        await db.saveBudgetAnalysis(input.requestId, JSON.stringify(analysis));
        return analysis;
      }),'''

new_content = content[:start_idx] + new_block + content[end_idx:]

with open('server/routers.ts', 'w') as f:
    f.write(new_content)

print("SUCCESS: analyzeBudget endpoint updated with Serper web search")
print(f"New file size: {len(new_content)} chars")
