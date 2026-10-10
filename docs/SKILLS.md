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

- Curva de nível: **nível 1 a 10**, com XP necessário crescendo a cada nível (valores a definir).
- A cada nível ganho, o jogador recebe **1 ponto de habilidade**.
- Os pontos são gastos para **desbloquear ou evoluir uma skill** (ver seção 3).

## 2. Controles de combate (base de todas as classes)

| Botão | Ação | Observação |
|---|---|---|
| **Botão esquerdo** | Ataque base | Cada classe tem o seu ataque base (ver seção 4). |
| **Botão direito** | Bloqueio base | Todas as classes podem bloquear. O bloqueio reduz o dano frontal. |
| **1** a **5** | Ativa a skill do slot correspondente | Os slots 1 a 5 são as skills da classe. |

Skills e perks não substituem o ataque base e o bloqueio: são ações extras.

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

## 4. Classes

As skills atuais de cada classe viraram o slot de skill correspondente. Os ataques base (botão esquerdo) continuam os mesmos.

### 4.1 Cavaleiro

- **Ataque base (esquerdo):** Golpe de espada (dano 30).

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Investida (atual) | Impacto: alcance maior e derruba o inimigo por mais tempo | Escudo erguido: reduz o dano recebido durante a investida |
| 2 | Escudada | Empurrão: empurra e atordoa o inimigo por 1 s | Contra-golpe: causa dano a quem tenta atacar nesse momento |
| 3 | Grito de guerra | Coragem: aliados próximos ganham vida extra temporária | Intimidação: inimigos próximos ficam lentos por 3 s |
| 4 | Golpe pesado | Carregado: dano dobrado com carga de 1 s | Quebra-escudo: ignora o bloqueio do alvo |
| 5 | Juramento | Regeneração: recupera vida enquanto bloqueia | Armadura: aumenta a redução de dano do bloqueio |

### 4.2 Bárbaro

- **Ataque base (esquerdo):** Machadada (dano 50, golpe lento).

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Redemoinho (atual) | Raio maior | Dano maior no centro |
| 2 | Chute (atual) | Empurra mais longe | Atordoa o alvo |
| 3 | Fúria | Mais dano por 5 s | Mais velocidade de ataque por 5 s |
| 4 | Arremesso de machado | Causa dano ao alvo e prende ele no chão | Retorna como um gancho e puxa o alvo |
| 5 | Pele de ferro | Imune a empurrões | Recupera vida a cada abate |

### 4.3 Arqueira

- **Ataque base (esquerdo):** Flecha, segurar para tensionar (dano de 16 a 58).
- **Botão direito:** mirar com zoom (base de todas as classes, sem alteração).

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Rajada (atual) | Mais flechas (9) | Flechas explosivas |
| 2 | Tiro perfurante | Atravessa inimigos | Dano extra contra inimigos parados |
| 3 | Armadilha de espinhos | Lenta o inimigo que passa | Causa dano ao pisar |
| 4 | Passo leve | Velocidade maior por 4 s | Não faz barulho (inimigos não te percebem) |
| 5 | Marca do caçador | Marca o alvo e revela sua posição | Dano extra a quem está marcado |

### 4.4 Maga

- **Ataque base (esquerdo):** Bola de fogo, explosão em área (dano 26).

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Nova gélida (atual) | Congela por mais tempo | Dano maior |
| 2 | Cura (atual) | Cura maior | Cura também por 3 s ao aliado |
| 3 | Escudo arcano | Absorve dano de um aliado | Reflete parte do dano |
| 4 | Teleporte curto | Recarga menor | Leva um aliado junto |
| 5 | Meteoro | Atraso de 2 s e área maior | Cai em três pontos |

### 4.5 Ladino

- **Ataque base (esquerdo):** Facada rápida (dano 20, triplo pelas costas).

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Fumaça (atual) | Dura mais | Velocidade maior |
| 2 | Esquiva (atual) | Distância maior | Deixa um rastro de fumaça |
| 3 | Veneno | Dano ao longo do tempo na lâmina | Espalha o veneno para inimigos próximos |
| 4 | Adaga arremessada | Dano médio à distância | Atordoa o alvo |
| 5 | Golpe traiçoeiro | Teleporta atrás do alvo | Dano maior se o alvo estiver carregando a princesa |

### 4.6 Alabardeiro (nova)

- **Ataque base (esquerdo):** Estocada com alabarda (alcance maior que a espada, sem escudo).
- **Modelo:** Cavaleiro (KayKit) com alabarda.

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Estocada | Empurra o alvo para trás | Dano maior no primeiro alvo |
| 2 | Varredura | Alcance maior | Atinge o dobro de alvos |
| 3 | Muralha | Prende inimigos que tentarem passar | Bloqueio maior enquanto parado |
| 4 | Investida com haste | Avança e estoca | Derruba o alvo |
| 5 | Gancho | Puxa o alvo para perto | Puxa também a princesa caída |

### 4.7 Espadachim (nova)

- **Ataque base (esquerdo):** Golpe de espada rápido (dano moderado).
- **Modelo:** Ladino sem capuz (KayKit) com espada.

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Contra-ataque | Bloqueio perfeito devolve dano | Bloqueio perfeito atordoa o atacante |
| 2 | Combo rápido | Três golpes seguidos | Último golpe causa mais dano |
| 3 | Corte giratório | Atinge todos ao redor | Recupera vida por alvo atingido |
| 4 | Salto | Avança e ataca em área | Pode ser usado no ar |
| 5 | Lâmina sangrenta | Sangramento por 5 s | Dano extra a quem está sangrando |

### 4.8 Invocador (nova)

- **Ataque base (esquerdo):** Raio sombrio à distância (dano baixo).
- **Modelo:** Mago (KayKit) com livro aberto.
- Os aliados invocados são **esqueletos** (modelos KayKit). Eles somem depois de um tempo ou quando morrem.

| Slot | Skill | Perk A | Perk B |
|---|---|---|---|
| 1 | Invocar lacaio | Dois lacaios | Lacaio mais resistente |
| 2 | Invocar guerreiro | Guerreiro com mais vida | Guerreiro que ataca à distância (mago) |
| 3 | Orbe sombrio | Dano maior | Rouba vida do alvo |
| 4 | Drenar vida | Cura o invocador ao causar dano | Cura os aliados invocados |
| 5 | Comandar | Invocados atacam o alvo marcado | Invocados ganham velocidade por 5 s |

## 5. Pontos em aberto

- O botão direito base (bloqueio) passa a ser igual para todas as classes. Isso tira os botões direitos atuais de Chute, Mirar, Cura e Esquiva. A proposta é colocá-los como skills (já feito acima). Confirme se isso vale.
- O XP vale só dentro da partida, ou se acumula entre partidas (precisaria de salvamento local).
- As perks são permanentes até o fim da partida, ou dá para trocar ao renascer?
- O invocador usa os esqueletos como aliados. Eles devem atacar quem é inimigo do dono, como os bots?
- Os valores de XP, dano e recargas são propostas e precisam de teste em partida.
