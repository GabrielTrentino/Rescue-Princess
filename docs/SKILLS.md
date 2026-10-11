# Sistema de experiência, níveis, skills e perks

Documento de planejamento. Os valores numéricos são propostas iniciais e devem ser ajustados nos testes.

## 1. Experiência e níveis

O jogador ganha **XP** durante a partida e sobe de nível. Ao subir, ganha pontos para desbloquear e evoluir skills.

| Fonte de XP | XP (proposta) |
|---|---|
| Abater um bot inimigo | 100 |
| Abater um esqueleto | 30 (lacaio) a 60 (guerreiro) |
| Dar um banquete à prisioneira | 50 |
| Pegar a princesa inimiga caída | 40 |
| Resgatar a princesa (entregar no trono) | 300 |
| Assistência (dano causado a um abatido) | 25 |
| Arma do mercador vendida na banca | 10 (comum) a 60 (lendária) |
| Obra do castelo concluída (mercador) | 80 |
| Ressuscitar um aliado (mercador) | 50 |

O Mercador de Almas quase não luta, então ganha XP principalmente pelo comércio, pelas obras e pela ressurreição.

- Curva de nível: **nível 1 a 10**, com XP necessário crescendo a cada nível (valores a definir).
- A cada nível ganho, o jogador recebe **1 ponto de habilidade**.
- Os pontos são gastos para **desbloquear ou evoluir uma skill** (ver seção 3).

## 2. Controles de combate (base de todas as classes)

| Botão | Ação | Observação |
|---|---|---|
| **Botão esquerdo** | Ataque base | Cada classe tem o seu ataque base (ver seção 4). |
| **Botão direito** | Bloqueio base | Todas as classes podem bloquear. O bloqueio reduz o dano frontal. Exceção: o Mercador de Almas no modo Invocador (seção 4.8). |
| **1** a **5** | Ativa a skill do slot correspondente | Os slots 1 a 5 são as skills da classe. |
| **E** | Interagir | Pegar itens e ouro do chão, abrir a banca do mercador, vender itens ao mercador (seção 5). |
| **'** (aspas simples) | Troca de modo | Só para o Mercador de Almas (seção 4.8). No teclado ABNT2 é a tecla à esquerda do 1 (`e.code === 'Backquote'`). |

Skills e perks não substituem o ataque base e o bloqueio: são ações extras.

**Princesa:** o **Ladino** e o **Mercador de Almas** não podem pegar nem carregar a princesa (nem a prisioneira, nem a princesa caída). Eles podem atacar quem a carrega normalmente.

## 3. Skills e perks

Cada classe tem **5 skills**, numeradas de 1 a 5. Cada skill tem **2 perks**.

- O jogador só pode escolher **um perk por skill**.
- Para cada skill, a escolha do perk é feita quando a skill é desbloqueada, e não pode ser trocada até o fim da partida (proposta; a regra pode mudar).
- Em cada classe, são 5 skills × 2 perks = 10 opções, das quais o jogador usa no máximo 5.

Proposta de desbloqueio das skills (cada uma custa 1 ponto de habilidade):

| Slot | Desbloqueio |
|---|---|
| 1 | Nível 1 (já disponível) |
| 2 | Nível 2 |
| 3 | Nível 4 |
| 4 | Nível 6 |
| 5 | Nível 8 |

### Como ler as tabelas de skills

| Coluna | Significado |
|---|---|
| **Dano** | Dano por acerto. "—" quando a skill não causa dano. "/s" é dano por segundo. |
| **Efeito** | O que a skill faz, sem os perks. |
| **Duração** | Quanto tempo o efeito dura. "Instantâneo" quando acontece de uma vez. |
| **Recarga** | Tempo, em segundos, até a skill poder ser usada de novo. |

- Distâncias e raios estão em **m**, que aqui significa a unidade do jogo (a mesma de `src/config.js`; 1 unidade ≈ 0,75 m reais).
- Skills marcadas como **(atual)** já existem no jogo. Os valores delas vêm de `src/config.js`. As demais são propostas.
- A tabela de perks descreve **o que muda** em relação à skill base.

## 4. Classes

As skills atuais de cada classe viraram o slot de skill correspondente. Os ataques base (botão esquerdo) continuam os mesmos.

### 4.1 Cavaleiro

- **Vida:** 160 · **Velocidade:** 6,6
- **Ataque base (esquerdo):** Golpe de espada. Dano 30, alcance 3,4 m, recarga 0,6 s.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Investida (atual) | 32 | Avança 13 m e empurra quem atingir no caminho. | Instantâneo | 8 s |
| 2 | Escudada | 15 | Golpe curto com o escudo que empurra o alvo. | Instantâneo | 6 s |
| 3 | Grito de guerra | — | Aliados num raio de 10 m ganham +15% de dano. | 6 s | 20 s |
| 4 | Golpe pesado | 55 | Golpe lento, com 0,5 s de preparo. | Instantâneo | 10 s |
| 5 | Juramento | — | O bloqueio anula todo o dano frontal e o cavaleiro não pode ser empurrado. | 5 s | 25 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Impacto:** avança 17 m e derruba o alvo por 1 s. | **Escudo erguido:** recebe 50% menos dano durante a investida. |
| 2 | **Empurrão:** atordoa o alvo por 1 s. | **Contra-golpe:** por 1 s, quem atacar o cavaleiro de frente leva 20 de dano. |
| 3 | **Coragem:** aliados também ganham 30 de vida extra temporária (6 s). | **Intimidação:** inimigos no raio ficam 30% mais lentos por 3 s. |
| 4 | **Carregado:** segurando por 1 s, o dano dobra (110). | **Quebra-escudo:** ignora o bloqueio do alvo. |
| 5 | **Regeneração:** recupera 8 de vida por segundo enquanto bloqueia. | **Armadura:** também reduz 30% do dano vindo dos lados e das costas. |

### 4.2 Bárbaro

- **Vida:** 190 · **Velocidade:** 6,2
- **Ataque base (esquerdo):** Machadada. Dano 50, alcance 3,7 m, recarga 1,0 s (golpe lento).

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Redemoinho (atual) | 42 | Gira o machado e atinge todos num raio de 4,8 m, empurrando. | Instantâneo | 9 s |
| 2 | Chute (atual) | 12 | Chute curto (2,8 m) que empurra o alvo com força. | Instantâneo | 4 s |
| 3 | Fúria | — | Entra em fúria: +10% de velocidade de movimento. | 5 s | 18 s |
| 4 | Arremesso de machado | 35 | Arremessa o machado (alcance 20 m). Fica sem ataque base até o machado voltar (1,5 s). | Instantâneo | 12 s |
| 5 | Pele de ferro | — | Recebe 25% menos dano. | 6 s | 25 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Raio maior:** raio de 6,5 m. | **Centro mortal:** +50% de dano (63) em quem está a até 2 m. |
| 2 | **Coice:** empurra bem mais longe. | **Atordoar:** atordoa o alvo por 1 s. |
| 3 | **Sede de sangue:** +35% de dano durante a fúria. | **Frenesi:** +40% de velocidade de ataque durante a fúria. |
| 4 | **Cravar:** prende o alvo no chão por 1,5 s. | **Gancho:** o machado volta puxando o alvo até o bárbaro. |
| 5 | **Inabalável:** imune a empurrões e atordoamentos durante o efeito. | **Banquete de guerra:** recupera 30 de vida a cada abate durante o efeito. |

### 4.3 Arqueira

- **Vida:** 95 · **Velocidade:** 7,3
- **Ataque base (esquerdo):** Flecha. Segurar para tensionar: dano de 16 a 58 (tensão máxima em 1 s), recarga 0,35 s. Tiro na cabeça causa 1,5× de dano.
- **Botão direito:** mirar com zoom (base de todas as classes, sem alteração).

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Rajada (atual) | 24 por flecha | Dispara 7 flechas em leque. | Instantâneo | 10 s |
| 2 | Tiro perfurante | 45 | Flecha reta e muito rápida, sem queda. | Instantâneo | 8 s |
| 3 | Armadilha de espinhos | — | Coloca uma armadilha no chão que prende o inimigo por 1 s. Máximo de 2 armadilhas. | Até 30 s ou até disparar | 12 s |
| 4 | Passo leve | — | +25% de velocidade de movimento. | 4 s | 14 s |
| 5 | Marca do caçador | Da flecha | Todas as flechas disparadas viram teleguiadas: curvam até o inimigo mais próximo da mira (cone de 25°, até 40 m). Vale para o ataque base e para as skills 1 e 2. | 8 s | 18 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Mais flechas:** 9 flechas. | **Flechas explosivas:** cada flecha explode (12 de dano num raio de 2 m). |
| 2 | **Perfurar:** atravessa até 3 inimigos. | **Paciência:** +50% de dano contra alvos parados. |
| 3 | **Espinhos lentos:** depois de solto, o alvo fica 50% mais lento por 3 s. | **Espinhos afiados:** causa 35 de dano ao pisar. |
| 4 | **Vento:** +45% de velocidade. | **Silêncio:** não faz barulho; bots só percebem a arqueira a menos de 8 m. |
| 5 | **Caçada longa:** dura 12 s. | **Presa:** quem for atingido fica marcado por 4 s, recebe +20% de dano de todas as fontes e fica visível para o time através das paredes. |

### 4.4 Maga

- **Vida:** 90 · **Velocidade:** 6,9
- **Ataque base (esquerdo):** Bola de fogo. Dano 26 com explosão num raio de 3,2 m, recarga 0,85 s.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Nova gélida (atual) | 16 | Inimigos num raio de 8 m ficam 45% mais lentos. | 3,5 s | 12 s |
| 2 | Cura (atual) | — | Cura 40 de vida da maga e dos aliados num raio de 10 m. | Instantâneo | 7 s |
| 3 | Escudo arcano | — | Escudo que absorve 50 de dano, na maga ou no aliado mirado (alcance 15 m). | 6 s | 15 s |
| 4 | Teleporte curto | — | Teleporta 10 m na direção da mira. | Instantâneo | 12 s |
| 5 | Meteoro | 80 no centro, 40 na borda | Meteoro cai no ponto mirado (alcance 30 m, raio 5 m) após 1,2 s. | Instantâneo | 30 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Inverno longo:** a lentidão dura 5 s. | **Gelo cortante:** dano 30. |
| 2 | **Cura maior:** cura 60. | **Renovar:** cura mais 8 por segundo durante 3 s (24 extra). |
| 3 | **Escudo reforçado:** absorve 80. | **Espelho:** devolve ao atacante 30% do dano absorvido. |
| 4 | **Passo rápido:** recarga de 7 s. | **Portal:** leva junto o aliado mais próximo (até 3 m). |
| 5 | **Cataclismo:** atraso de 2 s e raio de 7 m. | **Chuva de meteoros:** caem três meteoros menores (50 de dano, raio 3,5 m cada). |

### 4.5 Ladino

- **Vida:** 105 · **Velocidade:** 8,4 · **Não pode pegar a princesa** (ver seção 2).
- **Ataque base (esquerdo):** Facada rápida. Dano 20, recarga 0,34 s, dano triplo (60) pelas costas.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Fumaça (atual) | — | Fica invisível e ganha +35% de velocidade. | 5 s | 16 s |
| 2 | Esquiva (atual) | — | Avança 8 m rapidamente. | Instantâneo | 5 s |
| 3 | Veneno | 6/s | Os próximos 3 acertos da lâmina envenenam o alvo (24 de dano no total). | Lâmina: 8 s. Veneno: 4 s | 14 s |
| 4 | Adaga arremessada | 30 | Arremessa uma adaga (alcance 25 m). | Instantâneo | 6 s |
| 5 | Golpe traiçoeiro | — | O próximo ataque base, em até 3 s, conta como pelas costas, de qualquer ângulo. | 3 s | 20 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Sombra longa:** dura 7 s. | **Sombra veloz:** +60% de velocidade. |
| 2 | **Salto longo:** avança 12 m. | **Rastro:** deixa uma trilha de fumaça que bloqueia a visão por 3 s. |
| 3 | **Peçonha:** 10 de dano por segundo (40 no total). | **Contágio:** o veneno se espalha para inimigos a até 4 m do alvo. |
| 4 | **Lâmina pesada:** dano 45. | **Nocaute:** atordoa o alvo por 0,8 s. |
| 5 | **Passo sombrio:** teleporta para as costas do alvo mirado (alcance 12 m). | **Sequestrador:** dano dobrado se o alvo estiver carregando a princesa. |

### 4.6 Alabardeiro (nova)

- **Vida:** 140 · **Velocidade:** 6,5 (proposta)
- **Ataque base (esquerdo):** Estocada com alabarda. Dano 34, alcance 4,6 m (maior que a espada), arco estreito, recarga 0,8 s. Não tem escudo.
- **Modelo:** Cavaleiro (KayKit) com alabarda.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Estocada | 40 | Estocada longa (5,5 m) que atinge todos em linha. | Instantâneo | 6 s |
| 2 | Varredura | 28 | Golpe em arco de 180°, alcance 4,5 m, até 2 alvos. | Instantâneo | 7 s |
| 3 | Muralha | 15 | Finca a alabarda e fica parado: bloqueia todo o dano frontal, e quem entrar a 3 m na frente leva dano. | Até 4 s | 16 s |
| 4 | Investida com haste | 38 | Avança 9 m e estoca no final. | Instantâneo | 10 s |
| 5 | Gancho | 15 | Puxa o primeiro inimigo na linha (alcance 9 m) para a frente do alabardeiro. | Instantâneo | 14 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Repelir:** empurra os alvos para trás. | **Ponta afiada:** +50% de dano no primeiro alvo. |
| 2 | **Haste longa:** alcance de 6 m. | **Ceifa:** até 4 alvos. |
| 3 | **Barreira:** prende por 1,5 s quem tentar passar. | **Postura firme:** também reduz 50% do dano dos lados. |
| 4 | **Arremetida:** avança 13 m. | **Derrubar:** derruba o alvo por 1 s. |
| 5 | **Fisgar:** atordoa o alvo puxado por 0,8 s. | **Resgate:** também puxa a princesa caída. |

### 4.7 Espadachim (nova)

- **Vida:** 115 · **Velocidade:** 7,6 (proposta)
- **Ataque base (esquerdo):** Golpe de espada rápido. Dano 22, recarga 0,45 s.
- **Modelo:** Ladino sem capuz (KayKit) com espada.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Contra-ataque | — | Postura de aparar: anula o próximo golpe corpo a corpo recebido. | 0,6 s | 6 s |
| 2 | Combo rápido | 20 por golpe | Dois golpes seguidos em 0,4 s. | Instantâneo | 8 s |
| 3 | Corte giratório | 30 | Atinge todos num raio de 3,5 m. | Instantâneo | 10 s |
| 4 | Salto | 35 | Salta 8 m e golpeia ao cair (raio de 3 m). | Instantâneo | 12 s |
| 5 | Lâmina sangrenta | 5/s | Os ataques aplicam sangramento. | Lâmina: 6 s. Sangramento: 5 s | 20 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Riposta:** devolve ao atacante todo o dano anulado. | **Desarme:** atordoa o atacante por 1,2 s. |
| 2 | **Três golpes:** três golpes seguidos. | **Finalização:** o último golpe causa 40. |
| 3 | **Giro amplo:** raio de 5 m. | **Vampírico:** recupera 10 de vida por alvo atingido. |
| 4 | **Salto longo:** salta 12 m. | **Duplo salto:** pode ser usado no ar. |
| 5 | **Hemorragia:** 8 de dano por segundo. | **Instinto:** +25% de dano contra quem está sangrando. |

### 4.8 Mercador de Almas (nova)

Classe de suporte e economia, com dois modos: **Mercador** e **Invocador**. Quase não luta: fabrica e vende armas, melhora o castelo, anda invisível pelo mapa coletando ouro e itens, e usa almas para invocar esqueletos e ressuscitar aliados. Alterna entre os modos com a tecla **'**. Cada modo tem ataque base, botão direito e 5 skills próprios, e gasta um recurso diferente (energia ou almas). As duas barras aparecem no HUD.

- **Vida:** 100 · **Velocidade:** 6,8 (proposta)
- **Mochila:** 10 espaços (as outras classes têm 4; ver seção 5.4).
- É a **única classe que compra itens dos outros jogadores** (seção 5.5).
- **Não pode pegar a princesa** (seção 2).
- **Modelo:** Mago (KayKit). No modo Mercador segura uma bolsa de moedas; no modo Invocador, um livro aberto (verificar se existem esses acessórios no pacote KayKit).

#### Troca de modo (tecla ')

- A troca leva 0,3 s e tem recarga de 1,5 s. Não dá para trocar durante uma skill canalizada (Fabricar, Aprimorar).
- As recargas de cada modo correm separadas e continuam correndo no modo que não está ativo.
- Os esqueletos invocados continuam lutando depois da troca, e a invisibilidade do Véu continua ativa.
- O HUD mostra o modo ativo, as duas barras e o ouro do cofre do castelo o tempo todo.

#### Sistema de energia (modo Mercador)

A energia vai de **0 a 100** e é a capacidade de produção do mercador. **Não vem de combate.** Ele ganha energia vendendo barato, reciclando e coletando coisas pelo mapa, e gasta fabricando, aprimorando, vendendo caro e construindo obras.

A decisão central é como colocar cada arma à venda na banca:

| Modo de preço | Preço para o comprador | Efeito na energia |
|---|---|---|
| **Desconto** | 70% do preço base | **Ganha** energia quando a arma é vendida. |
| **Normal** | 100% do preço base | Nada. |
| **Sobrecarga** | 150% do preço base | **Gasta** energia na hora de expor (não volta se a arma for retirada). |

Ou seja: desconto equipa o time mais rápido e enche a energia, mas rende menos ouro para o cofre. Sobrecarga enche o cofre (que paga as obras), mas custa energia.

**Como ganhar energia**

| Fonte | Energia (proposta) |
|---|---|
| Regeneração passiva | +0,5 por segundo fora da cidade, +1 por segundo dentro |
| Pegar um item ou ouro do chão | +3 por coleta |
| Arma vendida com desconto | Tabela abaixo |
| Desmanchar uma arma (skill 4) | 50% da energia de fabricação dela |
| Comprar um item de um jogador | +2 |
| Alma coletada com a barra de almas cheia | +5 |

**Como gastar energia**

| Uso | Energia (proposta) |
|---|---|
| Fabricar uma arma (skill 1) | Tabela abaixo |
| Expor uma arma com sobrecarga | Tabela abaixo |
| Aprimorar uma arma (skill 3) | 8 × o nível novo (de +2 para +3 custa 24) |
| Abrir a banca à distância (skill 2) | 5 |
| Obras do castelo (skill 5) | Seção 6.3 |

**Tabela de fabricação e venda** (preços das armas na seção 5.2)

| Raridade | Energia para fabricar | Tempo de fabricação | Desconto: energia ganha | Sobrecarga: energia gasta |
|---|---|---|---|---|
| Comum | 10 | 2 s | +6 | 5 |
| Incomum | 18 | 3 s | +10 | 9 |
| Rara | 30 | 5 s | +16 | 15 |
| Épica | 45 | 7 s | +24 | 22 |
| Lendária | 65 | 10 s | +35 | 32 |

- Cada nível de atributo acima de +1 soma **+5 de energia e +1 s** na fabricação. Uma Lendária +5 custa 85 de energia e leva 14 s.
- O ganho do desconto e o custo da sobrecarga são multiplicados pelo mesmo multiplicador de nível do preço (seção 5.2).
- Fabricar e vender com desconto sempre dá prejuízo de energia, então não existe ciclo infinito. A energia líquida vem da regeneração, das coletas, da reciclagem e das compras de jogadores.

**Exemplo de ciclo:** no começo da partida, o mercador sai invisível pelo mapa pegando ouro e armas caídas (+3 de energia por coleta). Volta para a cidade, desmancha o que não serve, fabrica armas comuns e incomuns e vende com desconto, para equipar o time rápido e recuperar energia. No meio da partida, com energia sobrando e nível mais alto, fabrica armas raras e épicas e expõe com sobrecarga, enchendo o cofre para pagar as obras do castelo.

#### Barra de almas (modo Invocador)

Vai de 0 a **10 almas**. É o recurso das invocações e da ressurreição.

| Fonte de almas | Almas (proposta) |
|---|---|
| Elo de almas (botão direito) conectado num inimigo | 0,3 por segundo |
| Bot inimigo morre a até 15 m do invocador | 2 |
| Esqueleto morre a até 15 m do invocador | 1 |
| Aliado do time morre a até 15 m do invocador | 1 |
| Túmulos do mapa (pontos fixos, a definir) | 1 a cada 30 s, para quem passar por cima |

- Quando algo morre, a alma fica flutuando no local por **8 s**. O invocador precisa passar por cima (até 2 m) ou usar a skill Colheita de almas.
- Só o Mercador de Almas vê e coleta almas.
- Almas coletadas com a barra cheia viram 5 de energia cada.

#### Modo Mercador

- **Ataque base (esquerdo):** Arremesso de moeda. Dano 12, alcance 20 m, recarga 0,6 s. Não gera energia.
- **Botão direito:** bloqueio base.

| Slot | Skill | Custo | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|---|
| 1 | Fabricar | Energia da tabela | — | Abre o menu de fabricação: escolhe a classe da arma, a raridade, o atributo secundário e o nível (+1 a +5). O mercador fica parado fabricando; se levar dano, cancela e a energia volta. A arma vai para a mochila. | Tempo da tabela (+50% fora da cidade) | 1 s |
| 2 | Banca à distância | 5 de energia | — | Abre a banca do castelo de qualquer lugar do mapa: expor armas da mochila, retirar e escolher o modo de preço. Perto da banca (até 6 m), o acesso pela tecla E é livre e não custa energia. | Instantâneo | 20 s |
| 3 | Aprimorar | 8 × nível novo | — | Sobe +1 o atributo de uma arma da mochila ou da arma equipada de um aliado a até 4 m (máximo +5). Serve para recuperar armas que perderam nível ao cair. | 2 s (canalizado) | 4 s |
| 4 | Desmanchar | — | — | Destrói uma arma da mochila e devolve 50% da energia de fabricação dela. | Instantâneo | 1 s |
| 5 | Obras do castelo | Ouro do cofre + energia | — | Abre o menu de obras (seção 6.3). Só funciona dentro da cidade. | A obra fica pronta em 20 s | 5 s |

Raridades que o mercador consegue fabricar, pelo nível dele: comum (nível 1), incomum (2), rara (4), épica (6) e lendária (8).

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Mestre ferreiro:** fabrica 30% mais rápido. | **Economia:** fabricar custa 20% menos energia. |
| 2 | **Mascate:** recarga de 8 s e não custa energia. | **Vitrine:** a banca passa de 8 para 12 espaços de exposição. |
| 3 | **Ourives:** custa 30% menos energia. | **Refino:** também pode subir a raridade de uma arma, mantendo o atributo (custa a energia de fabricação da raridade nova). |
| 4 | **Reciclagem:** devolve 75% da energia. | **Sucata valiosa:** além da energia, rende ao cofre 25% do preço base da arma em ouro. |
| 5 | **Mestre de obras:** obras custam 20% menos ouro. | **Mutirão:** obras ficam prontas na hora. |

#### Modo Invocador

- **Ataque base (esquerdo):** Raio sombrio. Dano 14, alcance 25 m, recarga 0,7 s.
- **Botão direito, fora da cidade: Elo de almas.** Um raio liga o mercador ao inimigo mirado, até 15 m. Enquanto estiver ligado, gera **0,3 alma por segundo**. Não causa dano. Quebra se o alvo passar de 15 m ou sair da linha de visão.
- **Botão direito, dentro da cidade: Marcha.** Aliados a até 15 m (incluindo o mercador) ganham **+40% de velocidade de movimento por 15 s**. Custa 1 alma, recarga de 30 s.
- O ataque base e o Elo de almas contam como ataque e quebram a invisibilidade do Véu.
- Os aliados invocados são **esqueletos** (modelos KayKit, mesmos valores de `MONSTERS` em `src/config.js`), mas lutam pelo time do invocador. Somem quando o tempo acaba ou quando morrem.

| Slot | Skill | Custo | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|---|
| 1 | Véu | — | — | Fica invisível até atacar. Pegar ouro, itens e almas, usar Colheita de almas e invocar não quebram o Véu. Ao levar dano, pisca visível por 0,5 s, mas continua invisível. | Até atacar | 6 s (conta a partir do fim da invisibilidade) |
| 2 | Invocar lacaio | 1 alma | 12 por golpe | Invoca um Esqueleto Lacaio (70 de vida). Máximo de 3 lacaios ao mesmo tempo. | 25 s | 6 s |
| 3 | Invocar guerreiro | 3 almas | 22 por golpe | Invoca um Esqueleto Guerreiro (130 de vida). Máximo de 1. | 30 s | 15 s |
| 4 | Colheita de almas | — | — | Puxa todas as almas soltas num raio de 15 m. | Instantâneo | 10 s |
| 5 | Ressurreição | 10 almas | — | Escolhe um aliado morto (esperando para renascer). Ele volta na hora, ao lado do mercador, com +20% de velocidade de ataque. Quando o tempo acaba, ele morre e renasce no castelo **sem tempo de espera**, mantendo os +20% de velocidade de ataque por mais 15 s. | 60 s, mais 15 s de bônus após renascer | 90 s |

Detalhes da Ressurreição (proposta):
- Se o ressuscitado morrer antes dos 60 s, o resultado é o mesmo: renasce sem espera, com os 15 s de bônus.
- A morte no fim da ressurreição não derruba a arma (seção 5.3).

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Passos de fantasma:** +20% de velocidade de movimento enquanto invisível. | **Elo oculto:** o Elo de almas não quebra a invisibilidade. |
| 2 | **Ninhada:** invoca dois lacaios, cada um com 60% da vida. | **Ossos duros:** o lacaio tem +50% de vida (105). |
| 3 | **Campeão:** o guerreiro tem 200 de vida. | **Necromante:** invoca um Esqueleto Mago (ataque à distância, 18 de dano, alcance 18 m). |
| 4 | **Grande colheita:** raio de 25 m. | **Saqueador:** também puxa ouro e itens soltos no raio (cada um conta como coleta: +3 de energia). |
| 5 | **Vida longa:** o ressuscitado fica 90 s. | **Pacto barato:** custa 8 almas. |

#### Progressão do Mercador de Almas

A classe tem 10 skills (5 por modo), mas recebe os mesmos pontos de habilidade que as outras. Proposta: **cada ponto desbloqueia o mesmo slot nos dois modos** (por exemplo, o ponto do nível 2 libera Banca à distância e Invocar lacaio). O perk é escolhido separado para cada skill. O equilíbrio vem de a classe quase não ter dano e depender de dois recursos.

## 5. Economia: ouro, armas e mochila

### 5.1 Ouro

Cada jogador tem o seu próprio ouro, usado para comprar armas na banca do próprio castelo. O ouro não ocupa espaço na mochila.

| Fonte de ouro | Ouro (proposta) |
|---|---|
| Renda passiva | +1 por segundo |
| Moedas no chão (pontos fixos pelo mapa, voltam a cada 45 s) | 10 a 25 |
| Baú (poucos, longe dos castelos) | 100 |
| Abater um bot inimigo | 30 |
| Abater um esqueleto | 10 |
| Resgatar a princesa | 150 para cada jogador do time |
| Vender uma arma ao mercador | 50% do preço base (seção 5.5) |

O ouro que o próprio mercador pega vai direto para o cofre do castelo (seção 6.1).

### 5.2 Armas

- Cada classe começa com a **arma básica** (a atual), sem bônus. Ela nunca cai.
- O mercador fabrica armas de qualquer classe. O jogador só equipa armas da própria classe; as outras ficam na mochila e servem para vender ao mercador.
- Cada arma tem uma **raridade**, que dá bônus de dano, e um **atributo secundário** com nível de **+1 a +5**.

| Raridade | Cor do brilho | Bônus de dano | Preço base |
|---|---|---|---|
| Comum | Branco | +5% | 50 |
| Incomum | Verde | +10% | 100 |
| Rara | Azul | +15% | 200 |
| Épica | Roxo | +22% | 400 |
| Lendária | Laranja | +30% | 800 |

Atributo secundário (escolhido pelo mercador na fabricação):

| Atributo | Por nível | No +5 |
|---|---|---|
| Vida máxima | +8 | +40 |
| Velocidade de ataque | +3% | +15% |
| Velocidade de movimento | +2% | +10% |
| Roubo de vida | 2% do dano causado | 10% |
| Recarga das skills | −3% | −15% |

**Preço final = preço base × multiplicador de nível:** +1 ×1,0 · +2 ×1,25 · +3 ×1,5 · +4 ×1,75 · +5 ×2,0. Por exemplo, uma Épica +3 custa 400 × 1,5 = 600 de ouro, e uma Lendária +5 custa 1.600. O modo de preço da banca (desconto, normal ou sobrecarga) é aplicado em cima desse valor.

### 5.3 Morte e queda da arma

- Ao morrer, o jogador **derruba a arma equipada** no chão. Ela **perde 1 nível de raridade e 1 nível de atributo**. Por exemplo, uma Épica +3 cai como Rara +2.
- Uma arma +1 continua +1 e só perde a raridade.
- Uma arma comum não tem raridade abaixo: vira uma pilha de 25 de ouro no chão.
- A arma fica no chão por 30 s. Qualquer jogador, de qualquer time, pode pegar com E.
- O jogador renasce com a arma básica.
- A mochila e o ouro não caem (proposta).
- A morte no fim da Ressurreição do mercador não derruba a arma.

### 5.4 Mochila

- **4 espaços** para todas as classes e **10 para o Mercador de Almas**.
- A arma equipada e o ouro não ocupam espaço.
- Guarda armas pegas do chão ou compradas na banca. Uma tecla (a definir, por exemplo Tab) abre a mochila para trocar a arma equipada.

### 5.5 Vender itens ao mercador

- Os jogadores só podem vender itens para o **mercador do próprio time**, por **50% do preço base** da arma no estado atual (já contando a queda de nível).
- Para vender, é preciso chegar a até 4 m do mercador ou da banca e apertar E. Na banca, a venda funciona mesmo sem o mercador por perto: o item vai para o depósito da banca.
- O ouro pago sai do **cofre do castelo**. Se o cofre não tiver ouro suficiente, a venda não acontece.
- Cada compra dá +2 de energia ao mercador. Depois ele decide o que fazer com o item: revender na banca, aprimorar ou desmanchar.
- Armas do time inimigo pegas no chão também podem ser vendidas (proposta).
- Os bots também vendem itens à banca.

## 6. Castelo: cofre, banca e obras

**Cidade** é a área dentro das muralhas do castelo de cada time. Várias regras do mercador só valem dentro dela.

### 6.1 Cofre

- Cada castelo tem um cofre de ouro compartilhado pelo time. Começa com **200 de ouro**.
- **Entra no cofre:** o ouro das armas vendidas na banca e o ouro que o mercador pega no mapa.
- **Sai do cofre:** a compra de itens dos jogadores (seção 5.5) e as obras (seção 6.3).

### 6.2 Banca do mercador

- Fica num lugar fixo dentro da cidade de cada time, perto do trono (posição a definir no mapa).
- Tem **8 espaços de exposição** e um **depósito de 20 espaços** para os itens que os jogadores vendem quando o mercador não está.
- O mercador expõe armas da mochila e escolhe o modo de preço de cada uma (seção 4.8).
- Os jogadores do time abrem a banca com E e compram com o próprio ouro. Inimigos não podem usar a banca.
- Funciona sem o mercador por perto.
- Bots: ao renascer, compram a melhor arma da própria classe que conseguem pagar.

### 6.3 Obras

O mercador abre o menu de obras com a skill 5 do modo Mercador, dentro da cidade. Só uma obra pode ser construída por vez, e ela fica pronta em 20 s.

| Obra | Efeito por nível | Níveis | Custo por nível (ouro do cofre + energia) |
|---|---|---|---|
| Quartel | Tempo de renascimento −1 s (de 7 s até 4 s). | 3 | 250 + 20 · 500 + 35 · 900 + 50 |
| Ossuário | +1 no limite de lacaios do invocador. No nível 2, também +1 no limite de guerreiros. | 2 | 300 + 25 · 700 + 45 |
| Estandarte | +10% de XP para todo o time. | 3 | 300 + 20 · 600 + 35 · 1000 + 50 |
| Torres de defesa | Nível 1: uma torre (15 de dano a cada 1,5 s, alcance 22 m, 300 de vida). Nível 2: duas torres. Nível 3: 25 de dano e 500 de vida. | 3 | 400 + 30 · 700 + 45 · 1100 + 60 |
| Tesouraria | +0,5 de ouro por segundo para cada jogador do time. | 2 | 350 + 25 · 800 + 45 |

- As torres só atiram em inimigos dentro da cidade ou perto das muralhas. Podem ser destruídas, e reconstruir custa metade do preço.

## 7. Pontos em aberto

- O botão direito base (bloqueio) passa a ser igual para todas as classes. Isso tira os botões direitos atuais de Chute, Mirar, Cura e Esquiva. A proposta é colocá-los como skills (já feito acima). Confirme se isso vale.
- O XP vale só dentro da partida, ou se acumula entre partidas (precisaria de salvamento local).
- As perks são permanentes até o fim da partida, ou dá para trocar ao renascer?
- Os esqueletos invocados devem atacar quem é inimigo do dono, como os bots?
- Mercador de Almas: a energia e as almas se mantêm ao morrer, ou zeram ao renascer?
- Mercador de Almas: dar ao jogador 10 skills com os mesmos pontos pode deixá-lo forte demais. Alternativa: um ponto libera o slot em apenas um modo.
- A mochila e o ouro devem cair ao morrer? A proposta atual é que não.
- Time sem mercador: a banca fica vazia, ou um vendedor fixo vende armas comuns?
- Dois mercadores no mesmo time dividem o cofre e a banca?
- Onde ficam no mapa a banca, os túmulos, as moedas e os baús?
- Ladino: hoje ele carrega a princesa melhor que os outros (`carry: 1.0` em `src/config.js`, e a descrição da classe fala disso). Com a nova regra, o código e os bots precisam deixar de pegá-la.
- Os valores de XP, dano, recargas, ouro e energia são propostas e precisam de teste em partida.
