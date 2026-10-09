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
| Botão esquerdo | Ataque principal (a Arqueira segura para tensionar o arco) |
| Botão direito | Habilidade secundária |
| Q | Habilidade especial |
| E | Pegar ou soltar a princesa; dar o banquete à prisioneira |
| B | Trocar de classe (dentro do seu castelo) |
| Tab | Placar detalhado |
| Esc | Pausar |

## Classes

| Classe | Vida | Principal | Botão direito | Q |
|---|---|---|---|---|
| 🛡️ Cavaleiro | 160 | Golpe de espada | Bloquear com o escudo (reduz 75% do dano frontal) | Investida: avança derrubando inimigos |
| 🪓 Bárbaro | 190 | Machadada pesada | Chute que empurra | Redemoinho: dano em área ao redor |
| 🏹 Arqueira | 95 | Flecha (segure para tensionar; acerto na cabeça causa mais dano) | Mirar (zoom) | Rajada de 7 flechas |
| 🔮 Maga | 90 | Bola de fogo explosiva | Cura em área para aliados | Nova gélida: dano e lentidão |
| 🗡️ Ladino | 105 | Facadas rápidas (triplo de dano pelas costas) | Esquiva | Fumaça: fica invisível e mais rápido |

O Ladino é quem carrega a princesa mais rápido.

## Regras

- **Resgate:** pegue a sua princesa na masmorra inimiga com `E` e leve-a até o círculo brilhante do trono no seu castelo. Quem carrega a princesa anda mais devagar e não pode atacar.
- **Princesa caída:** se o carregador morre, ela cai no chão. Um aliado pode pegá-la de novo; se um inimigo encostar nela, ela volta para a masmorra. Depois de 25 segundos no chão, ela volta sozinha.
- **Banquetes:** pratos de comida aparecem pelo mapa. Leve um até a prisioneira do seu castelo para engordá-la (até 5 níveis). Quanto mais pesada, mais devagar o inimigo a carrega.
- **Esqueletos:** dois acampamentos de esqueletos (guerreiro, lacaio, mago e ladino) atacam os dois times e renascem depois de um tempo.
- **Vitória:** vence quem fizer primeiro o número de resgates escolhido no menu (1, 3 ou 5).

## Mapa

- Castelos com muralhas, torres, portão principal e portões laterais, masmorra da princesa e pátio com quartel e ferraria.
- Três rotas entre os castelos: a estrada central, a rota oeste pela floresta e a rota leste pelas colinas. Duas estradas cruzam as rotas.
- Um rio no meio do mapa, com uma ponte em cada rota. Atravessar pela água deixa você mais lento.
- Ruínas no centro e acampamentos de esqueletos nas laterais.

## Estrutura do código

```
index.html          menus e HUD
src/main.js         inicialização, menus, loop
src/game.js         partida: times, renascimento, placar
src/world.js        mapa: terreno, rio, pontes, castelos, vegetação, grafo de navegação
src/entities.js     personagens (modelo animado, movimento, estado)
src/player.js       controle em primeira pessoa e arma na mão
src/ai.js           bots (atacante, defensor, coletor) e esqueletos
src/combat.js       ataques, projéteis, habilidades e dano
src/objectives.js   princesas e banquetes
src/hud.js          placar, minimapa, marcadores e mensagens
src/collision.js    colisão 2D com altura e linha de visão
src/config.js       classes, monstros e dificuldade
public/assets/      modelos KayKit usados pelo jogo
preview.html        visualizador do mapa (desenvolvimento): preview.html?cam=x,y,z,alvoX,alvoY,alvoZ
```

Para ajustar o equilíbrio do jogo (vida, dano, velocidades e recargas), edite `src/config.js`.

## Créditos

- Modelos 3D: **KayKit** por Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)), licença CC0. Pacotes usados: Adventurers, Skeletons, Character Animations, Medieval Hexagon, Dungeon, Forest Nature e Fantasy Weapons Bits.
- Motor 3D: [three.js](https://threejs.org) (licença MIT).
