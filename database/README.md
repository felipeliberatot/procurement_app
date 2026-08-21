# Backup do banco de dados

> **Atenção:** `backup.sql` é um snapshot completo de estrutura e dados do banco de produção no momento em que foi gerado. Ele contém dados corporativos, dados pessoais, hashes de credenciais e tokens temporários de sessões de aprovação. O repositório deve permanecer **privado** e o arquivo não deve ser encaminhado, publicado ou copiado para serviços não autorizados.

O backup é criado com `mysqldump` e inclui tabelas, dados, triggers, eventos e rotinas. O banco atual usa TiDB gerenciado, que não aceita os `SAVEPOINTs` do modo transacional padrão do `mysqldump`; por isso o script utiliza uma leitura curta sem locks de tabela. Para gerar um snapshot atualizado, configure `DATABASE_URL` no ambiente e execute:

```bash
pnpm db:backup
```

Depois de copiar o repositório, valide a integridade do arquivo com `sha256sum -c database/backup.sql.sha256`.

Para restaurar em uma instância MySQL vazia, execute:

```bash
mysql -u SEU_USUARIO -p < database/backup.sql
```

O dump contém instruções `CREATE DATABASE`, `DROP DATABASE` e `USE`. Portanto, confirme que a instância de destino pode perder o banco com o mesmo nome antes da restauração.
