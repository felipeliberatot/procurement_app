import re

router_code = """
  // ─── Units / Unidades ─────────────────────────────────────────────────────────
  units: router({
    list: protectedProcedure.query(() => db.listUnits()),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
      }))
      .mutation(({ input }) => db.createUnit(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateUnit(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteUnit(input.id)),
  }),
"""

with open('/home/ubuntu/procurement_app/server/routers.ts', 'r') as f:
    content = f.read()

# Find the last router closing before export type AppRouter
# Insert units router before malotes router
insert_before = '  // ─── Malotes'
if insert_before in content:
    content = content.replace(insert_before, router_code + '  // ─── Malotes', 1)
else:
    # fallback: insert before last });
    last_close = content.rfind('});\nexport type AppRouter')
    if last_close == -1:
        last_close = content.rfind('});\n')
    content = content[:last_close] + router_code + content[last_close:]

with open('/home/ubuntu/procurement_app/server/routers.ts', 'w') as f:
    f.write(content)

print('Done - units router added')
