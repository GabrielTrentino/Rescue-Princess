# Sistema de experiência, níveis, skills e perks

Documento de design. **Implementado no jogo** (ver a seção 7 para as decisões tomadas nos pontos que estavam em aberto). Os valores numéricos ficam em `src/config.js` e `src/skills.js` e podem ser ajustados nos testes.

## 1. Experiência e níveis

O jogador ganha **XP** durante a partida e sobe de nível (1 a 10). Cada nível dá **1 ponto**.

| Fonte de XP | XP |
|---|---|
| Abater um bot inimigo | 100 |
| Abater um esqueleto | 30 (lacaio) a 60 (guerreiro) |
| Dar um banquete à prisioneira | 50 |
| Devolver a princesa inimiga caída | 40 |
| Resgatar a princesa (entregar no trono) | 300 |
| Assistência (dano causado a um abatido) | 25 |
| Destruir uma torre de defesa | 100 |
| Curar aliados (Sacerdote) | 1 a cada 2 de vida curada |
| Ressuscitar um aliado (Sacerdote) | 60 |
| Mercador: fabricar uma peça | 15 (comum) a 60 (lendária) |
| Mercador: peça vendida na banca | 10 (comum) a 60 (lendária) |
| Mercador: comprar um item de um jogador | 10 |
| Mercador: aprimorar | 12 |
| Mercador: desmanchar | 5 |
| Mercador: minerar | 8 |
| Mercador: melhoria da Oficina | 40 |
| Mercador: obra do castelo concluída | 80 |

O Mercador quase não luta: ganha XP com a fabricação, as trocas, as vendas, a mineração e as obras. As invocações passam o XP dos abates para o Invocador.

XP total por nível: 100, 250, 450, 700, 1.000, 1.350, 1.750, 2.200 e 2.700 (nível 10). O Estandarte (obra) dá +10% de XP por nível.

## 2. Controles de combate (base de todas as classes)

| Botão | Ação | Observação |
|---|---|---|
| **Botão esquerdo** | Ataque base | Cada classe tem o seu. O Invocador segura o botão num inimigo para o **Elo de almas**, que gera almas. |
| **Botão direito** | Bloqueio | Reduz o dano frontal (Cavaleiro 75%, as outras 50%). Arqueira: mirar com zoom. Invocador: **Marcha** (velocidade para os aliados). |
| **1** a **5** | Skills da classe | Todas já liberadas desde o nível 1. |
| **K** | Skills e perks | Escolher perks e evoluir skills. |
| **I** | Mochila e equipamento | Arma, capacete, peitoral e itens guardados. |
| **E** | Interagir | Princesa, banquete, pegar itens e ouro, minerar (Mercador), abrir a banca, vender ao mercador. |

**Princesa:** o **Ladino**, o **Mercador** e o **Invocador** não podem pegar nem carregar a princesa. Eles podem atacar quem a carrega e encostar na princesa inimiga caída para devolvê-la.

**Identificação dos times:** o seu time é sempre o azul. Cada personagem tem um anel no chão, um marcador acima da cabeça e o nome na cor do time, e o modelo fica tingido de azul ou vermelho. A mira fica **vermelha** sobre inimigos e **azul** sobre aliados.

## 3. Skills e perks

Cada classe tem **5 skills**, nas teclas 1 a 5, **todas liberadas desde o início**. Cada skill tem **2 perks**.

- Cada nível dá 1 ponto. Um ponto escolhe o perk de uma skill (um dos dois). A escolha vale até o fim da partida.
- Com os 5 perks escolhidos, os pontos seguintes evoluem uma skill para o **Nível II: −20% de recarga**. São 10 pontos no nível 10: 5 perks e 5 evoluções.
- Ao trocar de classe, a outra classe tem as próprias escolhas (os pontos são por classe; o nível é do jogador).
- Cada skill tem um **ícone** na barra do HUD e no menu de perks.

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

São 10 classes. Os ataques base (botão esquerdo) das classes originais continuam os mesmos; a cura da Maga passou para o Sacerdote.

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
| 2 | Lança de gelo | 35 | Lança rápida de gelo que deixa o alvo 40% mais lento por 2 s. (A cura passou para o Sacerdote.) | Instantâneo | 6 s |
| 3 | Escudo arcano | — | Escudo que absorve 50 de dano, na maga ou no aliado mirado (alcance 15 m). | 6 s | 15 s |
| 4 | Teleporte curto | — | Teleporta 10 m na direção da mira. | Instantâneo | 12 s |
| 5 | Meteoro | 80 no centro, 40 na borda | Meteoro cai no ponto mirado (alcance 30 m, raio 5 m) após 1,2 s. | Instantâneo | 30 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Inverno longo:** a lentidão dura 5 s. | **Gelo cortante:** dano 30. |
| 2 | **Lança perfurante:** atravessa até 3 inimigos. | **Congelar:** prende o alvo no lugar por 1 s. |
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

### 4.8 Sacerdote (nova)

- **Vida:** 110 · **Velocidade:** 6,8 · **Armadura da classe:** 25
- **Ataque base (esquerdo):** Raio sagrado. Projétil de luz: 12 de dano em inimigos e 10 de cura em aliados feridos que ele atravessa. Recarga 1 s.
- **Modelo:** Mago (KayKit) sem o chapéu, com cajado e escudo com brasão.

| Slot | Skill | Dano | Efeito | Duração | Recarga |
|---|---|---|---|---|---|
| 1 | Cura | — | Cura 40 de vida do sacerdote e dos aliados num raio de 10 m. | Instantâneo | 8 s |
| 2 | Luz sagrada | 25 (cura 35) | Raio de luz que atravessa os alvos: cura os aliados e fere os inimigos. | Instantâneo | 5 s |
| 3 | Bênção | — | Escudo que absorve 60 de dano, no aliado mirado (até 20 m) ou no sacerdote. | 6 s | 12 s |
| 4 | Purificar | — | Remove atordoamento, prisão, lentidão, veneno, sangramento e marcas dos aliados num raio de 10 m, que ficam imunes a eles. | 2 s | 14 s |
| 5 | Ressurreição | — | Escolhe um aliado morto: ele volta na hora, ao lado do sacerdote, com 50% da vida. | Instantâneo | 90 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Cura maior:** cura 60. | **Renovar:** cura mais 8 por segundo durante 3 s. |
| 2 | **Luz forte:** cura 50 e causa 35. | **Luz em cadeia:** cada acerto salta para mais um alvo a até 8 m. |
| 3 | **Graça:** absorve 90. | **Asas:** o abençoado também ganha +20% de velocidade. |
| 4 | **Água benta:** também cura 20. | **Clarão:** inimigos no raio ficam 30% mais lentos por 3 s. |
| 5 | **Milagre:** o aliado volta com a vida cheia. | **Fé:** recarga de 60 s. |

### 4.9 Mercador (nova)

Classe de economia. Quase não luta: minera, fabrica armas e armaduras, vende na banca do castelo, compra itens dos outros jogadores, faz obras e compra melhorias na Oficina.

- **Vida:** 110 · **Velocidade:** 6,8 · **Armadura da classe:** 20 · **Mochila:** 10 espaços
- **Ataque base (esquerdo):** Arremesso de moeda. Dano 12, alcance 20 m, recarga 0,6 s.
- **Modelo:** Bárbaro (KayKit) com o martelo de ferreiro.
- **Energia:** 0 a 100. Regenera 0,5 por segundo fora da cidade e 1 dentro. +3 por coleta de ouro ou item, +2 por compra de jogador. A venda com desconto devolve energia.
- **Minério:** recurso para aprimorar. Vem dos **veios de cristal** pelo mapa (E para minerar, 1,5 s, 2 a 4 minérios; o veio volta em 60 s) e de desmanchar peças.

| Slot | Skill | Custo | Efeito | Recarga |
|---|---|---|---|---|
| 1 | Fabricar | Energia: arma 20, capacete 14, peitoral 18 | Escolhe o tipo (arma de uma classe, capacete ou peitoral) e o atributo. **A raridade é sorteada** (tabela abaixo). A peça sai com +1. Fica parado 3 s (+50% fora da cidade); dano ou movimento cancela e devolve a energia. | 1 s |
| 2 | Banca à distância | 5 de energia | Abre a banca do castelo de qualquer lugar. Perto da banca, a tecla E é livre. | 20 s |
| 3 | Aprimorar | Energia 8 × nível novo e minério igual ao nível novo | Sobe +1 o atributo de uma peça da mochila ou de um aliado a até 4 m (máximo +5). Canalizado, 2 s. | 4 s |
| 4 | Desmanchar | — | Destrói uma peça e devolve 50% da energia de fabricação e 1 + raridade de minério. | 1 s |
| 5 | Obras do castelo | Ouro do cofre + energia | Abre as obras e a Oficina. Só dentro da cidade. | 5 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Mestre ferreiro:** fabrica 30% mais rápido. | **Economia:** fabricar custa 20% menos energia. |
| 2 | **Mascate:** recarga de 8 s e não custa energia. | **Vitrine:** +8 espaços de exposição na banca. |
| 3 | **Ourives:** 30% menos energia e 1 minério a menos. | **Refino:** também pode subir a raridade de uma peça (energia e 3 minérios). |
| 4 | **Reciclagem:** devolve 75% da energia e +1 minério. | **Sucata valiosa:** também rende ao cofre 25% do preço base em ouro. |
| 5 | **Mestre de obras:** obras custam 20% menos ouro. | **Mutirão:** obras ficam prontas na hora. |

**Chance de raridade ao fabricar.** O mercador não escolhe a raridade. No nível 1 ele fabrica de Comum a Rara (cerca de 61%, 29% e 10%). Cada nível aumenta a chance das raridades melhores. Épica e Lendária só saem depois das Forjas da Oficina.

**Oficina** (no menu da skill 5, paga com o ouro do cofre, vale para o time):

| Melhoria | Efeito | Custo |
|---|---|---|
| Forja de mestre | Libera a raridade Épica. | 500 |
| Forja lendária | Libera a raridade Lendária (precisa da Forja de mestre). | 1.000 |
| Sorte do ferreiro I, II e III | Cada uma aumenta a chance de raridades melhores (equivale a 3 níveis do mercador). | 250, 500 e 800 |
| Expositores extras | +6 espaços de exposição na banca. | 300 |

Com tudo comprado e nível 10, as chances ficam perto de 4% Comum, 39% Incomum, 39% Rara, 14% Épica e 4,5% Lendária.

### 4.10 Invocador (nova)

Gera almas e invoca esqueletos que **avançam sozinhos contra o inimigo**. As invocações não têm limite de tempo: o limite é de quantidade.

- **Vida:** 100 · **Velocidade:** 6,8 · **Armadura da classe:** 10
- **Ataque base (esquerdo, segurar):** **Elo de almas.** Liga num inimigo a até 15 m e gera 0,5 alma por segundo. Não causa dano.
- **Botão direito:** **Marcha.** Aliados a até 15 m (incluindo as invocações) ganham +40% de velocidade por 12 s. Recarga de 25 s.
- **Almas:** até 15. Toda morte deixa almas no chão (2 de personagens, 1 de esqueletos) por **30 s**. **Só o Invocador coleta**, passando por cima ou com a Colheita. Os túmulos do mapa dão 1 alma a cada 30 s.
- **Modelo:** Ladino encapuzado (KayKit) com o cajado de esqueleto e o livro aberto.

| Slot | Skill | Custo | Dano | Efeito | Recarga |
|---|---|---|---|---|---|
| 1 | Invocar lacaio | 1 alma | 12 por golpe | Esqueleto Lacaio (70 de vida). Máximo de 4. | 3 s |
| 2 | Invocar guerreiro | 3 almas | 22 por golpe | Esqueleto Guerreiro (130 de vida). Máximo de 2. | 8 s |
| 3 | Invocar arqueiro | 2 almas | 14 por flecha | Esqueleto Arqueiro (65 de vida, alcance 22 m). Máximo de 3. | 6 s |
| 4 | Invocar mago | 3 almas | 18 por raio | Esqueleto Mago (75 de vida, alcance 18 m). Máximo de 2. | 8 s |
| 5 | Colheita de almas | — | — | Puxa todas as almas no chão num raio de **50 m**. | 12 s |

| Slot | Perk A | Perk B |
|---|---|---|
| 1 | **Ninhada:** dois lacaios de uma vez, com 60% da vida. | **Ossos duros:** +50% de vida (105). |
| 2 | **Campeão:** 200 de vida. | **Fúria óssea:** +30% de dano. |
| 3 | **Flechas de fogo:** as flechas explodem (+8 num raio de 2 m). | **Olho de águia:** alcance de 30 m e +20% de dano. |
| 4 | **Gelo:** os raios deixam o alvo 30% mais lento por 2 s. | **Explosão:** os raios explodem num raio de 2,5 m. |
| 5 | **Banquete de almas:** cada alma colhida cura 15 do invocador e das invocações próximas. | **Ímpeto:** as invocações ganham +30% de velocidade e de dano por 8 s. |

O Ossuário (obra) soma +1 no limite de cada tipo de invocação por nível.

## 5. Economia: ouro, armas, armaduras e mochila

### 5.1 Ouro

Cada jogador tem o seu próprio ouro, usado para comprar armas e armaduras na banca do próprio castelo. O ouro não ocupa espaço na mochila.

| Fonte de ouro | Ouro |
|---|---|
| Renda passiva | +1 por segundo |
| Moedas no chão (pontos fixos pelo mapa, voltam a cada 45 s) | 10 a 25 |
| Baú (poucos, longe dos castelos) | 100 |
| Abater um bot inimigo | 30 |
| Abater um esqueleto | 10 |
| Resgatar a princesa | 150 para cada jogador do time |
| Vender uma peça ao mercador | 50% do preço (seção 5.6) |

O ouro que o próprio mercador pega vai direto para o cofre do castelo (seção 6.1).

### 5.2 Armas

- Cada classe começa com a **arma básica** (a atual), sem bônus. Ela nunca cai.
- O mercador fabrica armas de qualquer classe. O jogador só equipa armas da própria classe; as outras ficam na mochila e servem para vender ao mercador.
- Cada arma tem uma **raridade** (sorteada na fabricação, seção 4.9), que dá bônus de dano, e um **atributo secundário** com nível de **+1 a +5** (sobe com Aprimorar, que gasta energia e minério).

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
| Armadura extra | +4 | +20 |

**Preço final = preço base × multiplicador de nível:** +1 ×1,0 · +2 ×1,25 · +3 ×1,5 · +4 ×1,75 · +5 ×2,0. Por exemplo, uma Épica +3 custa 400 × 1,5 = 600 de ouro, e uma Lendária +5 custa 1.600. O modo de preço da banca (desconto, normal ou sobrecarga) é aplicado em cima desse valor.

### 5.3 Armaduras: capacete e peitoral

Todos os personagens têm **armadura**, que reduz o dano recebido: **redução = armadura / (armadura + 100)**. Com 50 de armadura, o dano cai 33%; com 100, cai 50%.

- **Armadura da classe:** Cavaleiro 45, Alabardeiro 40, Bárbaro 30, Espadachim 25, Sacerdote 25, Mercador 20, Ladino 15, Arqueira 15, Maga 10, Invocador 10.
- **Capacete e peitoral:** todo mundo começa com as peças básicas (capacete 5, peitoral 10). As peças do mercador somam mais, conforme a raridade:

| Raridade | Capacete | Peitoral |
|---|---|---|
| Comum | 8 | 15 |
| Incomum | 12 | 22 |
| Rara | 17 | 30 |
| Épica | 23 | 40 |
| Lendária | 30 | 52 |

- Capacete e peitoral servem para **qualquer classe** e também têm atributo secundário de +1 a +5 (inclusive o novo atributo **Armadura extra**, +4 por nível).
- O **capacete** também reduz o bônus do tiro na cabeça: 1,5× sem capacete, até 1,15× com um capacete forte.
- Ao morrer, só a arma cai. O capacete e o peitoral ficam com o dono.
- Os preços de capacete e peitoral são 60% e 80% do preço de uma arma da mesma raridade.

### 5.4 Morte e queda da arma

- Ao morrer, o jogador **derruba a arma equipada** no chão. Ela **perde 1 nível de raridade e 1 nível de atributo**. Uma arma comum vira uma pilha de 25 de ouro.
- A arma fica no chão por 30 s. Qualquer jogador pode pegar com E.
- O jogador renasce com a arma básica. A mochila, o ouro e as armaduras não caem.

### 5.5 Mochila

- **4 espaços** para todas as classes e **10 para o Mercador**.
- As peças equipadas (arma, capacete, peitoral) e o ouro não ocupam espaço.
- A tecla **I** abre a mochila para trocar as peças equipadas.

### 5.6 Vender itens ao mercador

- Os jogadores só podem vender itens para o **mercador do próprio time**, por **50% do preço base** da arma no estado atual (já contando a queda de nível).
- Para vender, é preciso chegar a até 4 m do mercador ou da banca e apertar E. Na banca, a venda funciona mesmo sem o mercador por perto: o item vai para o depósito da banca.
- O ouro pago sai do **cofre do castelo**. Se o cofre não tiver ouro suficiente, a venda não acontece.
- Cada compra dá +2 de energia ao mercador. Depois ele decide o que fazer com o item: revender na banca, aprimorar ou desmanchar.
- Armas do time inimigo pegas no chão também podem ser vendidas (proposta).
- Os bots também vendem itens à banca.

## 6. Castelo: cofre, banca e obras

**Cidade** é a área dentro das muralhas do castelo de cada time. Várias regras do mercador só valem dentro dela.

### 6.1 Cofre

- Cada castelo tem um cofre de ouro compartilhado pelo time. Começa com **250 de ouro**.
- **Entra no cofre:** o ouro das peças vendidas na banca e o ouro que o mercador pega no mapa.
- **Sai do cofre:** a compra de itens dos jogadores (seção 5.6), as obras (seção 6.3) e a Oficina (seção 4.9).

### 6.2 Banca do mercador

- Fica num lugar fixo dentro da cidade de cada time, perto do trono (posição a definir no mapa).
- Tem **12 espaços de exposição** (+8 com o perk Vitrine, +6 com os Expositores extras da Oficina) e um **depósito de 30 espaços** para os itens que os jogadores vendem quando o mercador não está.
- O mercador expõe peças da mochila e escolhe o modo de preço de cada uma: Desconto (70% do preço, ganha energia na venda), Normal (100%) ou Sobrecarga (150%, gasta energia ao expor).
- Os jogadores do time abrem a banca com E e compram com o próprio ouro. Inimigos não podem usar a banca.
- Funciona sem o mercador por perto.
- Bots: ao renascer, compram a melhor arma, capacete e peitoral que conseguem pagar.

### 6.3 Obras

O mercador abre o menu de obras com a skill 5 do modo Mercador, dentro da cidade. Só uma obra pode ser construída por vez, e ela fica pronta em 20 s.

| Obra | Efeito por nível | Níveis | Custo por nível (ouro do cofre + energia) |
|---|---|---|---|
| Quartel | Tempo de renascimento −1 s (de 7 s até 4 s). | 3 | 250 + 20 · 500 + 35 · 900 + 50 |
| Ossuário | +1 no limite de cada tipo de invocação do Invocador. | 2 | 300 + 25 · 700 + 45 |
| Estandarte | +10% de XP para todo o time. | 3 | 300 + 20 · 600 + 35 · 1000 + 50 |
| Torres de defesa | Nível 1: uma torre (15 de dano a cada 1,5 s, alcance 22 m, 300 de vida). Nível 2: duas torres. Nível 3: 25 de dano e 500 de vida. | 3 | 400 + 30 · 700 + 45 · 1100 + 60 |
| Tesouraria | +0,5 de ouro por segundo para cada jogador do time. | 2 | 350 + 25 · 800 + 45 |

- As torres só atiram em inimigos dentro da cidade ou perto das muralhas. Podem ser destruídas, e reconstruir custa metade do preço.

## 7. Decisões da implementação

| Ponto | Decisão |
|---|---|
| Botão direito | Bloqueio para todas as classes (Cavaleiro 75% do dano frontal, as outras 50%). Arqueira: mirar. Invocador: Marcha. |
| Skills e perks | As 5 skills já vêm liberadas. Cada nível dá 1 ponto para um perk; com os 5 perks escolhidos, os pontos evoluem skills para o Nível II (−20% de recarga). |
| XP | Vale só dentro da partida. |
| Mercador e Invocador | Viraram duas classes separadas (antes era o Mercador de Almas com dois modos). |
| Cura | Saiu da Maga e virou a classe Sacerdote. A Maga ganhou a Lança de gelo. |
| Raridade | Sorteada na fabricação. O nível do mercador e a Oficina aumentam as chances; as Forjas liberam Épica e Lendária. |
| Aprimorar | Custa energia e minério. O minério vem dos veios de cristal (E para minerar, só o Mercador) e de desmanchar peças. |
| Almas | Toda morte deixa almas no chão por 30 s. Só o Invocador coleta (passando por cima, pelos túmulos ou com a Colheita, raio de 50 m). |
| Invocações | Sem limite de tempo; limite de quantidade por tipo. Avançam pela rota até o castelo inimigo, lutando com quem encontram. Continuam vivas se o Invocador morrer. |
| Armaduras | Capacete e peitoral para todas as classes; só a arma cai ao morrer. |
| Bots à distância | A Arqueira bot tensiona o arco por 0,5 a 1,1 s antes de soltar e pausa entre os tiros; os outros bots à distância também pausam entre os disparos. O tempo depende da dificuldade. |
| Times | Azul é sempre o seu time. Anel no chão, marcador, nome e tinta na cor do time; mira vermelha sobre inimigos e azul sobre aliados. |
| Mochila e ouro | Não caem ao morrer. |
| Time sem mercador | A banca recebe peças comuns de um vendedor fixo a cada 15 s. |
| Bots | Com 6 ou mais jogadores por time, um bot de cada time é Mercador (no time azul, só se você não escolher o Mercador). Sacerdotes e Invocadores aparecem entre os bots. |
| Mapa | Banca à esquerda do pátio. Em cada metade: 8 pontos de moedas, 2 túmulos, 5 veios de minério e 1 baú no acampamento de esqueletos. Torres atrás do portão principal. |
