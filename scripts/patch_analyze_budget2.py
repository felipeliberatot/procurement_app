#!/usr/bin/env python3
"""Patch the analyzeBudget endpoint to add Serper web search - fixed version."""

with open('server/routers.ts', 'r') as f:
    content = f.read()

# Find the start and end markers
start_marker = '    analyzeBudget: protectedProcedure'
end_marker = '        return analysis;\n      }),'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: Could not find analyzeBudget start")
    exit(1)

end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: Could not find analyzeBudget end")
    exit(1)

end_idx += len(end_marker)
print(f"Found block at positions {start_idx}-{end_idx}")

# Build the new block carefully - avoid literal newlines inside template literals
new_block = (
    '    analyzeBudget: protectedProcedure\n'
    '      .input(z.object({\n'
    '        requestId: z.number(),\n'
    '        budgetFileUrl: z.string().url(),\n'
    '        requestDescription: z.string(),\n'
    '        requestItems: z.array(z.object({\n'
    '          name: z.string(),\n'
    '          quantity: z.number(),\n'
    '          unitPrice: z.number().nullable(),\n'
    '        })).optional(),\n'
    '      }))\n'
    '      .mutation(async ({ input }) => {\n'
    '        // Fase 1: Extrair itens do PDF via LLM\n'
    '        const extractionPrompt = "Você é um assistente especializado em leitura de documentos.\\nLeia o PDF do orçamento em anexo e extraia TODOS os itens listados.\\nRetorne APENAS um JSON: {\\\"items\\\":[{\\\"name\\\":\\\"nome\\\",\\\"quantity\\\":1,\\\"unitPrice\\\":100.00,\\\"totalPrice\\\":100.00}],\\\"supplier\\\":\\\"fornecedor\\\",\\\"totalBudget\\\":1000.00}\\nSe algum campo não estiver visível, use null.";\n'
    '\n'
    '        const extractionContent: Message["content"] = [\n'
    '          { type: "text", text: `Extraia os itens do orçamento para: "${input.requestDescription}"` },\n'
    '          { type: "file_url", file_url: { url: input.budgetFileUrl, mime_type: "application/pdf" } },\n'
    '        ];\n'
    '\n'
    '        const extractionResponse = await invokeLLM({\n'
    '          messages: [\n'
    '            { role: "system", content: extractionPrompt },\n'
    '            { role: "user", content: extractionContent },\n'
    '          ],\n'
    '          response_format: { type: "json_object" },\n'
    '        });\n'
    '\n'
    '        const extractedRaw = extractionResponse.choices[0].message.content;\n'
    '        const extractedStr = typeof extractedRaw === "string" ? extractedRaw : JSON.stringify(extractedRaw);\n'
    '        type ExtractedItem = { name: string; quantity: number; unitPrice: number | null; totalPrice: number | null };\n'
    '        type Extracted = { items: ExtractedItem[]; supplier?: string; totalBudget?: number };\n'
    '        let extracted: Extracted;\n'
    '        try {\n'
    '          extracted = JSON.parse(extractedStr) as Extracted;\n'
    '        } catch {\n'
    '          extracted = { items: input.requestItems?.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.unitPrice ? i.unitPrice * i.quantity : null })) ?? [] };\n'
    '        }\n'
    '\n'
    '        // Fase 2: Buscar preços reais no Google Shopping via Serper API\n'
    '        const serperKey = ENV.serperApiKey;\n'
    '        type WebPriceEntry = { min: number; max: number; avg: number; sources: Array<{ title: string; price: number; link: string; source: string }> };\n'
    '        const webPrices: Record<string, WebPriceEntry> = {};\n'
    '\n'
    '        if (serperKey && extracted.items.length > 0) {\n'
    '          const searchPromises = extracted.items.slice(0, 8).map(async (item) => {\n'
    '            try {\n'
    '              const resp = await fetch("https://google.serper.dev/shopping", {\n'
    '                method: "POST",\n'
    '                headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },\n'
    '                body: JSON.stringify({ q: `${item.name} preço`, gl: "br", hl: "pt-br", num: 5 }),\n'
    '              });\n'
    '              if (!resp.ok) return;\n'
    '              const data = await resp.json() as { shopping?: Array<{ title: string; price: string; link: string; source: string }> };\n'
    '              const prices = (data.shopping ?? [])\n'
    '                .map(r => ({ title: r.title, price: parseFloat((r.price ?? "").replace(/[R$\\s.]/g, "").replace(",", ".")), link: r.link, source: r.source }))\n'
    '                .filter(r => !isNaN(r.price) && r.price > 0);\n'
    '              if (prices.length > 0) {\n'
    '                const vals = prices.map(p => p.price);\n'
    '                webPrices[item.name] = {\n'
    '                  min: Math.min(...vals),\n'
    '                  max: Math.max(...vals),\n'
    '                  avg: vals.reduce((a, b) => a + b, 0) / vals.length,\n'
    '                  sources: prices.slice(0, 3),\n'
    '                };\n'
    '              }\n'
    '            } catch { /* ignore */ }\n'
    '          });\n'
    '          await Promise.all(searchPromises);\n'
    '        }\n'
    '\n'
    '        // Fase 3: Gerar parecer com LLM usando preços reais do Google Shopping\n'
    '        const hasWebPrices = Object.keys(webPrices).length > 0;\n'
    '        const webPricesLines = hasWebPrices\n'
    '          ? Object.entries(webPrices).map(([name, data]) =>\n'
    '              `- ${name}: min R$ ${data.min.toFixed(2)}, max R$ ${data.max.toFixed(2)}, média R$ ${data.avg.toFixed(2)} | ${data.sources.map(s => `${s.source} R$${s.price.toFixed(2)}`).join(", ")}`\n'
    '            ).join("\\n")\n'
    '          : "";\n'
    '        const webPricesContext = hasWebPrices\n'
    '          ? `\\n\\nPREÇOS REAIS DO GOOGLE SHOPPING (referência principal):\\n${webPricesLines}`\n'
    '          : "";\n'
    '\n'
    '        const refSource = hasWebPrices\n'
    '          ? "Use os PREÇOS REAIS DO GOOGLE SHOPPING fornecidos como referência principal."\n'
    '          : "Use seu conhecimento de preços do mercado brasileiro (2024-2025).";\n'
    '        const sourcesInstruction = hasWebPrices\n'
    '          ? "5. Inclua as fontes de preço no campo \'sources\' de cada item."\n'
    '          : "";\n'
    '\n'
    '        const systemPrompt = `Você é um especialista em compras e análise de orçamentos para o setor agrícola brasileiro.\\n${refSource}\\n\\nPara cada item:\\n1. Compare o preço do orçamento com os preços de mercado\\n2. Classifique: ADEQUADO (±15%), ACIMA_DO_MERCADO (15-30% acima), MUITO_ACIMA (>30% acima), ABAIXO_DO_MERCADO (>15% abaixo)\\n3. Calcule a variação percentual\\n4. Forneça uma justificativa técnica\\n${sourcesInstruction}\\n\\nRetorne JSON:\\n{"items":[{"name":"","quantity":1,"unitPrice":0,"totalPrice":0,"marketPriceMin":0,"marketPriceMax":0,"variation":0,"status":"ADEQUADO","justification":"","sources":[{"title":"","price":0,"link":"","source":""}]}],"totalBudget":0,"totalMarketMin":0,"totalMarketMax":0,"overallVariation":0,"recommendation":"APROVADO","summary":"","alerts":[],"usedWebSearch":${hasWebPrices}}`;\n'
    '\n'
    '        const itemsText = extracted.items.map(i => `- ${i.name}: ${i.quantity}x R$${(i.unitPrice ?? 0).toFixed(2)} = R$${(i.totalPrice ?? 0).toFixed(2)}`).join("\\n");\n'
    '        const userText = `Orçamento: "${input.requestDescription}" | Fornecedor: ${extracted.supplier ?? "N/A"} | Total: R$ ${(extracted.totalBudget ?? 0).toFixed(2)}\\n\\nItens:\\n${itemsText}${webPricesContext}\\n\\nEmita o parecer completo.`;\n'
    '\n'
    '        const response = await invokeLLM({\n'
    '          messages: [\n'
    '            { role: "system", content: systemPrompt },\n'
    '            { role: "user", content: userText },\n'
    '          ],\n'
    '          response_format: { type: "json_object" },\n'
    '        });\n'
    '\n'
    '        const rawContent = response.choices[0].message.content;\n'
    '        const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);\n'
    '        const analysis = JSON.parse(contentStr);\n'
    '        analysis.usedWebSearch = hasWebPrices;\n'
    '\n'
    '        await db.saveBudgetAnalysis(input.requestId, JSON.stringify(analysis));\n'
    '        return analysis;\n'
    '      }),'
)

new_content = content[:start_idx] + new_block + content[end_idx:]

with open('server/routers.ts', 'w') as f:
    f.write(new_content)

print("SUCCESS: analyzeBudget endpoint updated with Serper web search")
print(f"New file size: {len(new_content)} chars")
