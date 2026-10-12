# Resgate da Princesa

Jogo de ação em **primeira pessoa** inspirado em *Fat Princess*, feito com **Three.js** e os modelos gratuitos **KayKit** (CC0).

Dois castelos, um em cada ponta de um mapa longo. A sua princesa (Azul) está presa na masmorra do castelo Vermelho, e a princesa deles está presa na sua. Para vencer, invada o castelo inimigo, carregue a sua princesa de volta e deixe-a no círculo do trono do seu castelo. Ao mesmo tempo, impeça que o inimigo resgate a princesa dele.

## Como rodar

O jogo roda no navegador, mas precisa de um servidor local, porque o navegador bloqueia o carregamento dos modelos 3D quando o arquivo é aberto direto.

- **Windows:** dê dois cliques em `iniciar.bat`. Ele usa o Node.js ou o Python, o que estiver instalado, e abre `http://localhost:8000`.
- **Node.js:** `node servidor.js`
- **Python:** `python servidor.py`
- **VS Code:** abra a pasta e use a extensão *Live Server* no `index.html`.

O jogo não depende de `npm install` nem de internet: o Three.js (r169) já está incluído em `lib/three`.

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Mouse | Olhar |
| Shift | Correr (gasta fôlego; se zerar, só volta a correr com 35% da barra) |
| Espaço | Pular |
| Botão esquerdo | Ataque base (Arqueira: segure para tensionar; Invocador: segure num inimigo para o Elo de almas) |
| Botão direito | Bloquear (Arqueira: mirar com zoom; Invocador: Marcha) |
| 1 a 5 | Skills da classe |
| K | Escolher perks |
| I | Mochila e equipamento |
| E | Princesa, banquete, pegar armas e ouro, minerar (Mercador), abrir a banca, vender ao mercador, entrar no canhão |
| G | Usar seringa na sua princesa, bomba numa torre inimiga (Ladino) ou contaminar um banquete (Ladino) |
| B | Trocar de classe (dentro do seu castelo) |
| Tab | Placar detalhado |
| Esc | Pausar ou fechar menus |

## Classes

Cada classe tem um ataque base, o botão direito e **5 skills** (teclas 1 a 5), todas liberadas desde o início. Cada skill tem **2 perks**: a cada nível você escolhe um. A lista completa, com dano, efeito, duração e recarga, está em [`docs/SKILLS.md`](docs/SKILLS.md).

| Classe | Vida | Armadura | Skills (1 a 5) |
|---|---|---|---|
| 🛡️ Cavaleiro | 160 | 45 | Investida · Escudada · Grito de guerra · Golpe pesado · Juramento |
| 🪓 Bárbaro | 190 | 30 | Redemoinho · Chute · Fúria · Arremesso de machado · Pele de ferro |
| 🏹 Arqueira | 95 | 15 | Rajada · Tiro perfurante · Armadilha de espinhos · Passo leve · Marca do caçador |
| 🔮 Maga | 90 | 10 | Nova gélida · Lança de gelo · Escudo arcano · Teleporte curto · Meteoro |
| 🗡️ Ladino | 105 | 15 | Fumaça · Esquiva · Veneno · Adaga arremessada · Golpe traiçoeiro |
| 🔱 Alabardeiro | 140 | 40 | Estocada · Varredura · Muralha · Investida com haste · Gancho |
| ⚔️ Espadachim | 115 | 25 | Contra-ataque · Combo rápido · Corte giratório · Salto · Lâmina sangrenta |
| ✨ Sacerdote | 110 | 25 | Cura · Luz sagrada · Bênção · Purificar · Ressurreição |
| 💰 Mercador | 110 | 20 | Oficina (fabricar e aprimorar) · Banca à distância · Posto de suprimentos · Desmanchar · Obras e Reino |
| 💀 Invocador | 100 | 10 | Invocar lacaio · Invocar guerreiro · Invocar arqueiro · Invocar mago · Colheita de almas |

O Ladino, o Mercador e o Invocador não podem carregar a princesa.

## Progressão

- Você ganha **XP** abatendo inimigos e esqueletos, com assistências, alimentando a prisioneira, devolvendo a princesa inimiga e resgatando a sua. O Sacerdote ganha curando e ressuscitando; o Mercador ganha fabricando, vendendo, comprando, minerando e construindo.
- Do nível 1 ao 10. Cada nível dá **1 ponto**: escolha o perk de uma skill (tecla **K**). Com os 5 perks escolhidos, os pontos evoluem skills para o **Nível II** (−20% de recarga; no Mercador, que não tem recargas, −20% de energia).

## Economia e equipamento

- **Ouro:** renda passiva, moedas e baús pelo mapa, abates e resgates. Use para comprar peças na **banca do mercador**, no pátio do seu castelo.
- **Equipamento:** arma (da sua classe), capacete e peitoral (qualquer classe). Cada peça tem **raridade** (Comum a Lendária) e um **atributo** de +1 a +5. A **armadura** (da classe + capacete + peitoral) reduz o dano recebido. Ao morrer, só a arma cai, com um nível a menos.
- **Mercador:** não tem recargas. Minera minério nos veios de cristal; na **Oficina** (skill 1) fabrica peças e seringas (a raridade é sorteada) e, na aba Aprimorar, sobe o nível das peças com energia e minério. Monta **postos de suprimentos** que curam e protegem aliados. Com o ouro do cofre, compra melhorias **individuais** (Sua Oficina: forjas, sorte, ourives, refino, expositores), melhorias **globais** do time (Reino: vida, dano, armadura e velocidade, com preço que sobe a cada nível) e **obras**: Quartel, Ossuário, Estandarte, Torres de defesa e Tesouraria.
- **Torres de defesa:** ficam do lado de fora do portão e atiram flechas (níveis 1 e 2) ou balas de canhão com explosão (nível 3). O **Ladino** compra **bombas** na banca e, com `G` perto de uma torre inimiga, planta uma que a destrói sozinha.
- **Seringa:** com `G` perto da sua princesa (ou carregando-a), ela perde 1 nível de peso. Vem da banca (aba Boticário), da fabricação do Mercador, de esqueletos e da **carroça do boticário**, um evento que aparece nas ruínas centrais. O Ladino pode usá-la para **contaminar um banquete**: se o inimigo o der à prisioneira, ela emagrece. Só Ladinos veem banquetes contaminados.
- **Invocador:** toda morte deixa **almas** no chão por 30 s, e só o Invocador as coleta. Com elas ele invoca lacaios, guerreiros, arqueiros e magos esqueletos, que avançam sozinhos contra o inimigo.
- Se o time não tiver mercador, um vendedor fixo coloca peças comuns na banca.

## Códice

O botão **📖 Códice** no menu inicial abre um guia com as regras, todas as classes (skills e perks), a economia, os itens e eventos e as mecânicas escondidas. Os números vêm direto do código, então o guia acompanha as mudanças de equilíbrio.

## Times

O seu time é sempre o **azul**. Todo personagem tem um anel no chão, um marcador e o nome na cor do time, e a mira fica vermelha sobre inimigos e azul sobre aliados.

## Regras

- **Resgate:** pegue a sua princesa na masmorra inimiga com `E` e leve-a até o círculo brilhante do trono no seu castelo. Quem carrega a princesa anda mais devagar e não pode atacar.
- **Princesa caída:** se o carregador morre, ela cai no chão. Um aliado pode pegá-la de novo; se um inimigo encostar nela, ela volta para a masmorra. Depois de 25 segundos no chão, ela volta sozinha.
- **Banquetes:** pratos de comida aparecem pelo mapa. Leve um até a prisioneira do seu castelo para engordá-la (até 5 níveis). Quanto mais pesada, mais devagar o inimigo a carrega.
- **Esqueletos:** dois acampamentos de esqueletos (guerreiro, lacaio, mago e ladino) atacam os dois times e renascem depois de um tempo.
- **Vitória:** vence quem fizer primeiro o número de resgates escolhido no menu (1, 2, 3 ou 5).

## Mapa

- **Canhão de lançamento** do lado de fora do portão de cada castelo: com `E`, arremessa você para perto do meio do mapa, no seu lado do rio, num ponto sorteado.
- **Entrepostos:** quatro torres de vigia (duas por lado) com escada e segundo andar cercado por parapeito.

- Castelos com muralhas, torres, portão principal e portões laterais, masmorra da princesa e pátio com quartel e ferraria.
- Três rotas entre os castelos: a estrada central, a rota oeste pela floresta e a rota leste pelas colinas. Duas estradas cruzam as rotas.
- Um rio no meio do mapa, com uma ponte em cada rota. Atravessar pela água deixa você mais lento.
- Ruínas no centro e acampamentos de esqueletos nas laterais, cada um com um baú de ouro.
- Moedas espalhadas pelas rotas, veios de minério para o Mercador e túmulos onde o Invocador colhe almas.

## Estrutura do código

```
index.html          menus e HUD
src/main.js         inicialização, menus, loop
src/game.js         partida: times, renascimento, placar
src/world.js        mapa: terreno, rio, pontes, castelos, vegetação, grafo de navegação
src/entities.js     personagens (modelo animado, movimento, status, arma equipada)
src/player.js       controle em primeira pessoa e arma na mão
src/ai.js           bots (atacante, defensor, coletor, sacerdote, mercador, invocador), esqueletos e invocações
src/combat.js       ataque base, bloqueio, skills, projéteis, status e dano
src/skills.js       as 5 skills e os perks de cada classe
src/progression.js  XP, níveis, pontos, perks e Nível II
src/economy.js      ouro, armas e armaduras, mochila, banca, cofre, Oficina, Reino, minério, obras, torres, bombas, seringas, posto de suprimentos, carroça do boticário, moedas, baús e almas
src/menus.js        menus de perks, mochila, banca (com o Boticário), Oficina (fabricar e aprimorar), obras, Oficina individual, Reino e ressurreição
src/cannon.js       canhão de lançamento (voo e ponto de queda sorteado)
src/codex.js        Códice do menu inicial: regras, classes, economia, itens e mecânicas escondidas
src/objectives.js   princesas, banquetes e banquetes contaminados
src/hud.js          placar, minimapa, marcadores e mensagens
src/collision.js    colisão 2D com altura e linha de visão
src/config.js       classes, monstros, dificuldade, XP, economia, Reino, seringa e bomba
docs/SKILLS.md      design das skills, perks, progressão e economia
public/assets/      modelos KayKit usados pelo jogo
preview.html        visualizador do mapa (desenvolvimento): preview.html?cam=x,y,z,alvoX,alvoY,alvoZ
```

Para ajustar o equilíbrio do jogo, edite `src/config.js` (vida, velocidades, XP, ouro, preços, obras) e `src/skills.js` (dano, recarga e efeito de cada skill).

## Créditos

- Modelos 3D: **KayKit** por Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)), licença CC0. Pacotes usados: Adventurers, Skeletons, Character Animations, Medieval Hexagon, Dungeon, Forest Nature e Fantasy Weapons Bits.
- Motor 3D: [three.js](https://threejs.org) (licença MIT).
