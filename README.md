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
| Shift | Correr (gasta fôlego) |
| Espaço | Pular |
| Botão esquerdo | Ataque base (a Arqueira segura para tensionar o arco) |
| Botão direito | Bloquear (Arqueira: mirar com zoom; Mercador no modo Invocador: Elo de almas ou Marcha) |
| 1 a 5 | Skills da classe |
| K | Escolher skills e perks |
| I | Mochila |
| E | Pegar ou soltar a princesa, dar o banquete, pegar armas e ouro, abrir a banca, vender ao mercador |
| ' ou Q | Mercador de Almas: troca entre os modos Mercador e Invocador |
| B | Trocar de classe (dentro do seu castelo) |
| Tab | Placar detalhado |
| Esc | Pausar ou fechar menus |

## Classes

Cada classe tem um ataque base, o bloqueio e **5 skills** (teclas 1 a 5). Cada skill tem **2 perks**, e você escolhe um. A lista completa, com dano, efeito, duração e recarga, está em [`docs/SKILLS.md`](docs/SKILLS.md).

| Classe | Vida | Ataque base | Skills (1 a 5) |
|---|---|---|---|
| 🛡️ Cavaleiro | 160 | Golpe de espada | Investida · Escudada · Grito de guerra · Golpe pesado · Juramento |
| 🪓 Bárbaro | 190 | Machadada | Redemoinho · Chute · Fúria · Arremesso de machado · Pele de ferro |
| 🏹 Arqueira | 95 | Flecha tensionada | Rajada · Tiro perfurante · Armadilha de espinhos · Passo leve · Marca do caçador |
| 🔮 Maga | 90 | Bola de fogo | Nova gélida · Cura · Escudo arcano · Teleporte curto · Meteoro |
| 🗡️ Ladino | 105 | Facada (triplo pelas costas) | Fumaça · Esquiva · Veneno · Adaga arremessada · Golpe traiçoeiro |
| 🔱 Alabardeiro | 140 | Estocada de longo alcance | Estocada · Varredura · Muralha · Investida com haste · Gancho |
| ⚔️ Espadachim | 115 | Golpe rápido | Contra-ataque · Combo rápido · Corte giratório · Salto · Lâmina sangrenta |
| 💰 Mercador de Almas | 100 | Moeda / Raio sombrio | Modo Mercador: Fabricar · Banca à distância · Aprimorar · Desmanchar · Obras do castelo. Modo Invocador: Véu · Invocar lacaio · Invocar guerreiro · Colheita de almas · Ressurreição |

O Ladino e o Mercador de Almas não podem carregar a princesa.

## Progressão

- Você ganha **XP** abatendo inimigos e esqueletos, com assistências, alimentando a prisioneira, devolvendo a princesa inimiga e resgatando a sua. O Mercador também ganha com vendas, obras e ressurreições.
- Do nível 1 ao 10. Cada nível dá **1 ponto**. Os slots de skill liberam nos níveis 1, 2, 4, 6 e 8: gaste o ponto escolhendo um dos 2 perks da skill (aperte **K**). Pontos extras evoluem uma skill liberada para o **Nível II** (−20% de recarga).

## Economia

- **Ouro:** renda passiva, moedas e baús pelo mapa, abates e resgates. Use para comprar armas na **banca do mercador**, no pátio do seu castelo.
- **Armas:** cada classe começa com a arma básica. As armas da banca têm **raridade** (Comum a Lendária: +5% a +30% de dano) e um **atributo** de +1 a +5 (vida, velocidade de ataque, velocidade de movimento, roubo de vida ou recarga das skills). Ao morrer, a arma cai no chão com um nível a menos.
- **Mochila:** 4 espaços (10 no Mercador). Armas de outras classes podem ser vendidas ao mercador por 50% do preço.
- **Mercador de Almas:** fabrica armas com **energia**, escolhe o preço na banca (desconto, normal ou sobrecarga), aprimora e desmancha armas e constrói **obras** com o ouro do cofre do castelo: Quartel, Ossuário, Estandarte, Torres de defesa e Tesouraria. No modo Invocador, usa **almas** para invocar esqueletos e ressuscitar aliados.
- Se o time não tiver mercador, um vendedor fixo coloca armas comuns na banca.

## Regras

- **Resgate:** pegue a sua princesa na masmorra inimiga com `E` e leve-a até o círculo brilhante do trono no seu castelo. Quem carrega a princesa anda mais devagar e não pode atacar.
- **Princesa caída:** se o carregador morre, ela cai no chão. Um aliado pode pegá-la de novo; se um inimigo encostar nela, ela volta para a masmorra. Depois de 25 segundos no chão, ela volta sozinha.
- **Banquetes:** pratos de comida aparecem pelo mapa. Leve um até a prisioneira do seu castelo para engordá-la (até 5 níveis). Quanto mais pesada, mais devagar o inimigo a carrega.
- **Esqueletos:** dois acampamentos de esqueletos (guerreiro, lacaio, mago e ladino) atacam os dois times e renascem depois de um tempo.
- **Vitória:** vence quem fizer primeiro o número de resgates escolhido no menu (1, 2, 3 ou 5).

## Mapa

- Castelos com muralhas, torres, portão principal e portões laterais, masmorra da princesa e pátio com quartel e ferraria.
- Três rotas entre os castelos: a estrada central, a rota oeste pela floresta e a rota leste pelas colinas. Duas estradas cruzam as rotas.
- Um rio no meio do mapa, com uma ponte em cada rota. Atravessar pela água deixa você mais lento.
- Ruínas no centro e acampamentos de esqueletos nas laterais, cada um com um baú de ouro.
- Moedas espalhadas pelas rotas e túmulos onde o Mercador de Almas colhe almas.

## Estrutura do código

```
index.html          menus e HUD
src/main.js         inicialização, menus, loop
src/game.js         partida: times, renascimento, placar
src/world.js        mapa: terreno, rio, pontes, castelos, vegetação, grafo de navegação
src/entities.js     personagens (modelo animado, movimento, status, arma equipada)
src/player.js       controle em primeira pessoa e arma na mão
src/ai.js           bots (atacante, defensor, coletor, mercador), esqueletos e invocações
src/combat.js       ataque base, bloqueio, skills, projéteis, status e dano
src/skills.js       as 5 skills e os perks de cada classe
src/progression.js  XP, níveis, pontos, perks e Nível II
src/economy.js      ouro, armas, mochila, banca, cofre, obras, torres, moedas, baús e almas
src/menus.js        menus de skills, mochila, banca, fabricação, obras e ressurreição
src/objectives.js   princesas e banquetes
src/hud.js          placar, minimapa, marcadores e mensagens
src/collision.js    colisão 2D com altura e linha de visão
src/config.js       classes, monstros, dificuldade, XP e economia
docs/SKILLS.md      design das skills, perks, progressão e economia
public/assets/      modelos KayKit usados pelo jogo
preview.html        visualizador do mapa (desenvolvimento): preview.html?cam=x,y,z,alvoX,alvoY,alvoZ
```

Para ajustar o equilíbrio do jogo, edite `src/config.js` (vida, velocidades, XP, ouro, preços, obras) e `src/skills.js` (dano, recarga e efeito de cada skill).

## Créditos

- Modelos 3D: **KayKit** por Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)), licença CC0. Pacotes usados: Adventurers, Skeletons, Character Animations, Medieval Hexagon, Dungeon, Forest Nature e Fantasy Weapons Bits.
- Motor 3D: [three.js](https://threejs.org) (licença MIT).
