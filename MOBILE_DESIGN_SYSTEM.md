# ODIN MOBILE — DESIGN SYSTEM

**Version:** 1.0  
**Status:** Design Specification  
**Platform:** Android / iOS  
**Framework:** Expo + React Native + TypeScript

---

# 1. VISÃO DO PRODUTO

## 1.1. Conceito

O ODIN Mobile é a interface de controle pessoal de uma inteligência artificial autônoma.

Não deve ser tratado como uma versão reduzida do dashboard web. É um terminal de interação e supervisão, projetado para permitir que o usuário acompanhe, consulte, controle e autorize operações do ODIN.

A experiência deve combinar:

- Spatial User Interface.
- Heads-Up Display (HUD).
- Radial Navigation.
- Horizontal Information Architecture.
- Contextual Command Center.
- Conversational AI Interface.

A referência estética e conceitual é a tecnologia apresentada nos filmes Iron Man, especialmente as interfaces de Tony Stark e J.A.R.V.I.S.

A referência cinematográfica deve orientar a linguagem visual, mas não comprometer ergonomia, legibilidade ou usabilidade.

## 1.2. Princípios fundamentais

1. Spatial First: a organização da interface deve explorar relações espaciais entre informações.
2. Horizontal First: a exploração de módulos e conteúdos deve priorizar deslocamentos horizontais.
3. Contextual Interface: os elementos apresentados devem responder ao contexto atual.
4. State Driven: toda representação de atividade deve refletir estados reais do sistema.
5. Motion with Purpose: animações devem comunicar transições, relações e estados.
6. Native Ergonomics: os controles devem respeitar os padrões de interação mobile.
7. Progressive Disclosure: informações avançadas aparecem conforme a necessidade.
8. Operational Safety: operações críticas precisam de confirmação e feedback explícito.

---

# 2. IDENTIDADE VISUAL

## 2.1. Direção estética

A interface deve transmitir:

- Inteligência.
- Precisão.
- Controle.
- Tecnologia.
- Profundidade.
- Sofisticação.

A estética deve ser futurista, minimalista e funcional.

Evitar:
- Excesso de neon.
- Glow em todos os elementos.
- Bordas decorativas desnecessárias.
- Informações excessivamente pequenas.
- Cards convencionais em excesso.
- Interfaces que pareçam dashboards administrativos genéricos.
- Animações que dificultem a leitura.

## 2.2. Paleta de cores

A identidade principal utiliza grafite e laranja.

| Token | Cor | Aplicação |
|---|---|---|
| background-primary | #090D12 | Fundo principal |
| background-secondary | #101720 | Superfícies |
| background-tertiary | #18212C | Elementos elevados |
| accent-primary | #F28B32 | Identidade ODIN |
| accent-secondary | #52C7D9 | Dados e indicadores |
| text-primary | #F1F4F7 | Texto principal |
| text-secondary | #9BA8B5 | Texto auxiliar |
| text-muted | #637181 | Informações discretas |
| success | #35B77A | Operação concluída |
| warning | #E9AE45 | Atenção |
| danger | #E45C5C | Erros e riscos |
| border-subtle | #27313C | Contornos |

As cores semânticas devem ser utilizadas consistentemente.

Laranja representa a identidade do ODIN, não necessariamente um estado de sucesso ou atividade.

Ciano deve representar informações secundárias, conexões e indicadores técnicos.

## 2.3. Tipografia

Preferir fontes sans-serif modernas.

Hierarquia:

- Display: identidade do sistema e indicadores principais.
- Heading: títulos de módulos.
- Body: informações e conteúdo.
- Caption: metadados.
- Monospace: logs, códigos, identificadores e métricas técnicas.

Utilizar tamanhos legíveis em diferentes densidades de tela.

Nunca reduzir a legibilidade para reproduzir a aparência de HUDs cinematográficos.

## 2.4. Superfícies

A interface utilizará:

- Camadas translúcidas moderadas.
- Contornos discretos.
- Separadores finos.
- Gradientes sutis.
- Profundidade por contraste e sobreposição.

Blur e transparência devem ser aplicados seletivamente, considerando consumo de GPU e desempenho.

---

# 3. ARQUITETURA DA EXPERIÊNCIA

## 3.1. Estrutura principal

O aplicativo terá seis módulos principais:

1. Command Center
2. Neural Interface
3. Projects
4. Memory
5. Automations
6. Infrastructure

A navegação deve preservar o contexto entre os módulos.

O usuário não deve perder o estado de uma conversa, projeto ou atividade ao consultar outra área.

## 3.2. Command Center

Responsabilidade: oferecer uma visão consolidada do ODIN.

Elementos:

- Núcleo visual central.
- Estado geral do agente.
- Estado do Hermes Gateway.
- Estado do servidor.
- Atividade atual.
- Tarefas em andamento.
- Notificações.
- Acesso rápido à conversa.
- Indicadores de conectividade.

O Command Center deve funcionar como ponto de entrada principal.

## 3.3. Neural Interface

Responsabilidade: comunicação direta com o ODIN.

Funcionalidades:

- Conversação por texto.
- Entrada e saída de voz.
- Streaming de respostas.
- Exibição de ferramentas utilizadas.
- Estado de execução.
- Histórico de conversas.
- Interrupção de tarefas.
- Aprovações de operações.

A interface deve diferenciar visualmente:

- Pensamento e processamento representados pelo estado de execução, sem expor raciocínio interno privado.
- Respostas finais.
- Chamadas de ferramentas.
- Resultados de ferramentas.
- Solicitações de autorização.
- Erros.

## 3.4. Projects

Responsabilidade: centralizar projetos e MVPs hospedados no servidor.

Funcionalidades:

- Listagem de projetos.
- Estado de cada projeto.
- Ambientes.
- Deploys.
- Logs.
- Serviços associados.
- URLs de acesso.
- Histórico de alterações.

A interface deve priorizar exploração horizontal e detalhes contextuais.

## 3.5. Memory

Responsabilidade: visualizar a memória persistente do ODIN.

Funcionalidades:

- Informações armazenadas.
- Categorias de memória.
- Relações entre informações.
- Histórico de atualização.
- Contextos recuperados.
- Busca semântica.

Representações em grafos podem ser utilizadas quando agregarem valor real.

Não utilizar visualizações de rede apenas como decoração.

## 3.6. Automations

Responsabilidade: controlar tarefas autônomas.

Funcionalidades:

- Automações ativas.
- Tarefas agendadas.
- Execuções em andamento.
- Histórico.
- Gatilhos.
- Aprovações pendentes.
- Resultados e falhas.

## 3.7. Infrastructure

Responsabilidade: monitorar e controlar a infraestrutura.

Elementos:

- Servidor principal.
- Hermes Gateway.
- Backend.
- Banco de dados.
- Tailscale.
- Serviços ativos.
- CPU.
- Memória RAM.
- Armazenamento.
- Disponibilidade.

Ações destrutivas ou de alto impacto devem exigir autorização explícita.

---

# 4. SISTEMA DE NAVEGAÇÃO

## 4.1. Arc Navigation

O principal elemento de navegação será um sistema radial semicircular.

Características:

- Módulos distribuídos em um arco.
- Seleção por gestos.
- Indicador de módulo ativo.
- Módulos adjacentes parcialmente visíveis.
- Transições suaves.
- Feedback háptico.

O arco deve permanecer visualmente integrado ao núcleo da interface.

A navegação radial deve funcionar como mecanismo de descoberta e seleção, não como substituto de todos os controles tradicionais.

## 4.2. Comportamento

1. O usuário inicia um gesto sobre a região interativa.
2. O arco acompanha o movimento.
3. O módulo mais próximo do ponto de seleção recebe destaque.
4. Ao finalizar o gesto, o módulo é selecionado.
5. O conteúdo contextual é atualizado.
6. O contexto anterior é preservado.

Não selecionar módulos acidentalmente durante scrolls ou interações com outros elementos.

## 4.3. Horizontal Information Deck

Dentro dos módulos, utilizar navegação horizontal para explorar categorias relacionadas.

Exemplo de Projects:

Overview → Activity → Deploys → Logs → Settings

Características:

- Scroll horizontal nativo.
- Snap points quando apropriado.
- Indicadores de posição.
- Continuidade visual entre painéis.
- Preservação da posição durante mudanças de contexto.

## 4.4. Scroll vertical

A rolagem vertical continua disponível para:

- Conversas.
- Logs extensos.
- Documentos.
- Listas longas.
- Histórico de atividades.

O sistema deve distinguir claramente os eixos de interação para evitar conflitos entre gestos horizontais, verticais e radiais.

---

# 5. CENTRAL CORE

## 5.1. Conceito

O Central Core é o principal elemento visual do ODIN.

Representa a presença e o estado operacional do agente.

Não deve ser apenas um objeto animado.

Deve refletir informações reais do sistema.

## 5.2. Estados

| Estado | Representação |
|---|---|
| Idle | Núcleo estável e pulsação discreta |
| Listening | Indicadores de entrada de áudio |
| Processing | Animação de atividade |
| Executing | Movimento e indicadores de execução |
| Waiting Approval | Destaque de autorização pendente |
| Speaking | Animação sincronizada com áudio, quando disponível |
| Error | Indicador de falha |
| Offline | Aparência reduzida e indicação de desconexão |

## 5.3. Informações associadas

- Agente ativo.
- Modelo utilizado.
- Conectividade.
- Tarefa atual.
- Duração da execução.
- Estado do gateway.

O núcleo não deve apresentar informações falsas ou estados simulados.

---

# 6. MOTION DESIGN

## 6.1. Filosofia

As animações devem comunicar mudanças de estado, hierarquia e relações espaciais.

Não devem existir apenas para impressionar.

## 6.2. Categorias

### Microinterações

- Feedback de seleção.
- Botões.
- Indicadores.
- Haptics.
- Transições de estado.

### Navegação

- Movimento do arco.
- Seleção de módulos.
- Transições entre painéis.
- Scroll com snap.

### Sistema

- Mudança de estado do Central Core.
- Indicadores de atividade.
- Notificações.
- Execuções de tarefas.

## 6.3. Tecnologias

Priorizar:

- React Native Reanimated.
- React Native Gesture Handler.
- React Native SVG.
- React Native Skia, quando houver necessidade real.

Evitar animações controladas exclusivamente por atualizações frequentes do React.

Utilizar shared values e animações na UI thread quando apropriado.

## 6.4. Performance

Objetivos:

- Animações próximas de 60 FPS ou superiores quando suportadas.
- Gestos responsivos.
- Nenhum bloqueio da interface durante requisições.
- Evitar renderizações desnecessárias.
- Reduzir efeitos gráficos caros.
- Respeitar configurações de redução de movimento.

---

# 7. DESIGN SYSTEM DE COMPONENTES

Componentes principais:

```text
components/
├── core/
│   ├── CentralCore.tsx
│   ├── CoreStatus.tsx
│   └── CoreIndicators.tsx
│
├── navigation/
│   ├── ArcNavigation.tsx
│   ├── ArcSegment.tsx
│   ├── HorizontalDeck.tsx
│   └── NavigationIndicator.tsx
│
├── panels/
│   ├── ContextPanel.tsx
│   ├── InformationPanel.tsx
│   └── DetailPanel.tsx
│
├── system/
│   ├── SystemStatus.tsx
│   ├── ServerMetrics.tsx
│   └── ConnectionIndicator.tsx
│
├── activity/
│   ├── ActivityStream.tsx
│   ├── ExecutionStatus.tsx
│   └── ToolExecution.tsx
│
├── interaction/
│   ├── CommandInput.tsx
│   ├── VoiceControl.tsx
│   └── ApprovalPanel.tsx
│
└── primitives/
    ├── GlowIndicator.tsx
    ├── HUDDivider.tsx
    ├── StatusLabel.tsx
    └── MotionContainer.tsx
```

Essa estrutura é uma referência lógica, não uma exigência de criar todos os arquivos antecipadamente.

Cada componente deve ter responsabilidade única e propriedades tipadas.

Evitar componentes gigantes que concentrem navegação, requisições, animações e apresentação.

---

# 8. ARQUITETURA TÉCNICA

## 8.1. Separação de responsabilidades

Separar:

- UI: componentes visuais.
- Presentation: estado e comportamento da interface.
- Domain: regras de negócio.
- Data: comunicação com APIs.
- Infrastructure: conexões e integrações.

A camada visual não deve acessar diretamente o banco de dados, processos do servidor ou ferramentas do Hermes.

## 8.2. Integração com backend

O frontend deve utilizar os contratos e endpoints existentes.

Antes de implementar qualquer integração:

1. Inspecionar os endpoints.
2. Identificar os modelos de resposta.
3. Verificar autenticação.
4. Identificar mecanismos de atualização.
5. Documentar os estados possíveis.

Preferir WebSocket para eventos e atualizações em tempo real quando suportado pelo backend.

Utilizar HTTP para operações convencionais.

## 8.3. Estado

Distinguir:

- Estado local de componentes.
- Estado de navegação.
- Estado global da aplicação.
- Estado remoto do backend.

Não duplicar dados remotos em múltiplos estados globais sem necessidade.

Toda informação operacional deve ter origem identificável.

## 8.4. Estados obrigatórios

Todos os módulos devem tratar:

- Loading.
- Success.
- Empty.
- Error.
- Offline.
- Stale data.

Não utilizar mocks como substitutos permanentes dos dados do backend.

Dados fictícios só são permitidos em protótipos explicitamente identificados e devem ser removidos antes da integração.

---

# 9. RESPONSIVIDADE E ERGONOMIA

Considerar:

- Diferentes dimensões de tela.
- Safe areas.
- Orientação do dispositivo.
- Densidade de pixels.
- Uso com uma mão.
- Áreas de toque confortáveis.
- Teclado virtual.
- Acessibilidade.

A orientação vertical será o padrão inicial.

A arquitetura deve permitir avaliar orientação horizontal futuramente, mas não deve depender dela para funcionar.

Os principais controles devem permanecer acessíveis ao polegar.

A interface não pode depender de gestos complexos sem alternativas convencionais.

---

# 10. ACESSIBILIDADE

Implementar:

- Labels acessíveis.
- Estados anunciáveis.
- Contraste adequado.
- Alternativas para gestos radiais.
- Suporte a leitores de tela.
- Escalonamento de fontes.
- Redução de movimento.
- Feedback visual além de cores.

Nenhuma ação crítica pode depender exclusivamente de uma animação, cor ou gesto.

---

# 11. SEGURANÇA OPERACIONAL

O aplicativo é uma interface de controle de um agente autônomo.

Portanto, a experiência deve distinguir:

### Ações informativas

Podem ser executadas sem confirmação adicional.

Exemplos:
- Consultar status.
- Ler logs.
- Consultar projetos.
- Visualizar métricas.

### Ações operacionais

Devem respeitar as permissões definidas pelo backend.

Exemplos:
- Iniciar tarefas.
- Executar comandos.
- Modificar projetos.

### Ações sensíveis

Devem exigir autorização explícita.

Exemplos:
- Excluir arquivos.
- Modificar configurações sensíveis.
- Instalar dependências.
- Interromper serviços críticos.
- Executar operações fora do workspace autorizado.

O frontend nunca deve ser considerado a única camada de segurança. A autorização precisa ser validada no backend.

---

# 12. ESTRUTURA DE IMPLEMENTAÇÃO

A implementação deve ocorrer progressivamente.

## Fase 1 — Auditoria

- Inspecionar o aplicativo atual.
- Mapear componentes reutilizáveis.
- Identificar dependências.
- Documentar endpoints.
- Identificar problemas existentes.

## Fase 2 — Design Foundation

- Criar tokens visuais.
- Definir tipografia.
- Criar primitivas.
- Implementar superfícies e indicadores.
- Criar o tema global.

## Fase 3 — Core Interface

- Construir Central Core.
- Implementar estados operacionais.
- Construir Command Center.
- Integrar status reais.

## Fase 4 — Navigation System

- Implementar Arc Navigation.
- Implementar Horizontal Deck.
- Configurar gestos.
- Testar conflitos de scroll.
- Implementar feedback háptico.

## Fase 5 — Modules

Implementar progressivamente:

1. Neural Interface.
2. Projects.
3. Memory.
4. Automations.
5. Infrastructure.

## Fase 6 — Integration

- Conectar dados reais.
- Implementar streaming.
- Implementar eventos.
- Implementar erros e reconexão.
- Implementar aprovações.

## Fase 7 — Optimization

- Testes em dispositivos reais.
- Avaliação de FPS.
- Avaliação de consumo de memória.
- Acessibilidade.
- Testes de navegação.
- Testes de desconexão.

---

# 13. CRITÉRIOS DE ACEITAÇÃO

Uma implementação só pode ser considerada concluída quando:

- [ ] A identidade visual está consistente.
- [ ] A navegação radial funciona.
- [ ] O scroll horizontal funciona sem conflitos.
- [ ] A rolagem vertical continua utilizável.
- [ ] O Central Core representa estados reais.
- [ ] Os módulos preservam contexto.
- [ ] Os dados vêm do backend.
- [ ] Loading, Error e Offline estão implementados.
- [ ] A interface funciona em diferentes dimensões de tela.
- [ ] Os controles são acessíveis.
- [ ] Operações sensíveis exigem autorização.
- [ ] Não existem mocks operacionais.
- [ ] As animações não bloqueiam a interface.
- [ ] A aplicação continua compatível com a infraestrutura existente.

---

# 14. REGRAS PARA AGENTES DE DESENVOLVIMENTO

Qualquer agente que trabalhe no frontend do ODIN deve:

1. Ler este documento antes de modificar a interface.
2. Consultar as Skills relevantes para a tarefa.
3. Inspecionar os componentes existentes antes de criar novos.
4. Preservar contratos de API.
5. Não alterar o backend sem autorização específica.
6. Não introduzir dependências sem justificar sua necessidade.
7. Evitar abstrações desnecessárias.
8. Não criar dados fictícios para simular funcionalidades existentes.
9. Manter componentes pequenos e reutilizáveis.
10. Testar os comportamentos de interação.
11. Documentar decisões arquiteturais relevantes.
12. Priorizar consistência sobre efeitos visuais isolados.

Se houver conflito entre estética cinematográfica e usabilidade, a usabilidade deve prevalecer.

Se houver conflito entre este documento e uma limitação técnica real, documentar o problema e propor uma alternativa antes de implementar uma solução estruturalmente diferente.

---

# 15. DEFINIÇÃO FINAL

O ODIN Mobile deve ser reconhecido como um terminal pessoal de inteligência artificial.

Não deve parecer um dashboard web comprimido em uma tela de celular.

Sua identidade deve surgir da combinação entre:

- Núcleo central inteligente.
- Navegação espacial.
- Interfaces radiais.
- Exploração horizontal.
- Informação contextual.
- Interação por voz e gestos.
- Controle operacional real.

**Design principle: The interface should make the system feel present, understandable and controllable — never merely futuristic.**