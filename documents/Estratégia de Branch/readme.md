# Estratégia de Branch e Estrutura do Projeto
Este documento descreve a estratégia de gerenciamento de branch e a organização dos pacotes do projeto, garantindo que o desenvolvimento seja colaborativo, organizado e seguro.

<br>

## 📋 Estratégia de Branch Utilizada

Para manter o código organizado e evitar conflitos, seguimos a seguinte estrutura de branches no GitHub:

- **main**: Branch principal. Contém apenas código testado e aprovado. Nenhum código deve ser enviado diretamente para a `main`.

- **Branches de pacotes**: Os pacote do sistema possuem sua própria branch de desenvolvimento. Exemplos: `branch-api`, `branch-web`, `branch-coleta`.

### 🔀 Fluxo de trabalho

1. O desenvolvimento deve ser realizado sempre na branch correspondente ao pacote ou funcionalidade.  
2. Ao finalizar uma implementação ou correção, deve-se abrir um **Pull Request (PR)** para a `main`.  
3. O PR deve ser revisado antes de ser aceito.  
4. Após o merge, o código passa a integrar a versão oficial do projeto.  

> Esse fluxo garante que a `main` permaneça estável e que cada desenvolvedor possa trabalhar sem interferir no código dos outros.


## Branches do Projeto

Abaixo, a descrição das principais branches:

### 📂 api
- Utilizada para desenvolvimento do backend.  

### 📂 web
- Utilizada para desenvolvimento do frontend.  

### 📂 notebooks
- Utilizada para registrar arquivos .ipynb.  

### 📂 coleta
- Utilizada para trabalhar na coleta de dados do Banco Central do Brasil.  

<br>

> Essa estrutura garante uma separação clara de responsabilidades, facilita a manutenção e torna o projeto escalável e colaborativo.
