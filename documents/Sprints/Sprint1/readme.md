# Sprint - 1️⃣ 🎯
Sprint concluída ✅
<br>

## Base do Sistema Funcionando:


https://github.com/user-attachments/assets/e4ee63ae-eba1-4e8a-954c-3be0fa3492b8


## Backlog da Sprint 📝

<hr>

| Rank | Prioridade | User Story | Estimativa | Data de entrega |
|:----:|:----------:|:----------:|:----------:|:------:|
| 1  | Alta | "Como analista de crédito da DM, quero coletar e integrar dados públicos do Banco Central (concessão de crédito, inadimplência e indicadores econômicos) para alimentar o sistema com informações oficiais." | 45h | 05/04 | 
| 2  | Alta | "Como gestor da DM, quero visualizar um dashboard funcional com o indicador de volume de concessão de crédito por região (estados), utilizando dados reais do Banco Central, para validar a integração e iniciar as análises desde a primeira entrega." | 40h | 05/04 | 
| 3  | Média | "Como analista de crédito, quero filtrar os dados por estado e período mensal, com capacidade de visualizar séries históricas completas, para identificar sazonalidade e variações de inadimplência mês a mês." | 30h | 05/04 | 

<br>

# 📌 DoR e DoD da Sprint 1

### **MVP da Sprint 1:**  
1️⃣ Sprint I: Dashboard funcional com dados reais > Coleta dados regionais do Banco Central, e expõe com ranking de estados e filtros por estado/período.


### User Stories da Sprint 1

1. **Como analista de crédito da DM, quero coletar e integrar dados públicos do Banco Central (concessão de crédito, inadimplência e indicadores econômicos) para alimentar o sistema com informações oficiais.**  
   - **DoR:** Fontes do BCB identificadas e URLs das APIs/arquivos validadas (tasks 1.1); campos e granularidade dos dados definidos (UF, mês/ano, modalidade); estrutura do banco SQLite esboçada; ambiente Colab acessível ao time.  
   - **DoD:**  
     - [x] Fontes levantadas e documentadas com links e descrição.  
     - [x] Script de coleta no Colab funcional, com tratamento e padronização dos dados.
     - [x] Banco SQLite criado com schema definido e dados inseridos sem erros.
     - [x] Dados consultáveis manualmente via SQL (validação de integridade básica).
  

2. **Como gestor da DM, quero visualizar um dashboard funcional com o indicador de volume de concessão de crédito por região (estados), utilizando dados reais do Banco Central, para validar a integração e iniciar as análises desde a primeira entrega.**  
   - **DoR:** Banco populado com dados reais; estrutura de pastas do front-end definida; layout/wireframe inicial aprovado; endpoint da API definido para retorno de dados por estado.  
   - **DoD:**  
     - [x] API FastAPI criada com endpoint funcional para concessão por estado.  
     - [x] Tela inicial desenvolvida e acessível no browser.  
     - [x] Front-end consumindo a API via fetch sem erros.
     - [x] Gráfico de barras com ranking dos estados renderizado corretamente.
     - [x] Cards com valores totais e médias nacionais exibidos na tela.



3. **Como analista de crédito, quero filtrar os dados por estado e período mensal, com capacidade de visualizar séries históricas completas, para identificar sazonalidade e variações de inadimplência mês a mês.**  
   - **DoR:** Dashboard base entregue; API já existente pronta para receber parâmetros; estados e intervalo de datas disponíveis no banco; componentes de UI do front definidos no design.
   - **DoD:**  
     - [x] Dropdown de estados e seletor de mês/ano implementados no front.
     - [x] API com endpoints que aceitam parâmetros de estado e período e retornam dados filtrados.  
     - [x] Filtros integrados ao front. 

