title = "CARD Q";

description = `
[Tap Column]
 Pull out a card
[Tap Edge]
 Refresh hand
 `;

characters = [
  `
l  l
l l l
l l l
l l l
l l l
l  l
`,
];

options = {
  isPlayingBgm: true,
  isReplayEnabled: true,
  seed: 8,
};

const numChars = [
  "",
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

/** @type {{num: number, pos: Vector, tPos:Vector, gPos:Vector }[]} */
let playerCards;
/** @type {{num: number, pos: Vector, tPos:Vector, gPos:Vector }[]} */
let enemyCards;
/** @type {{num: number, pos: Vector, tPos:Vector }[]} */
let placedCards;
/** @type { number[]} */
let placedCardNumbers;
let centerY;
let targetCenterY;
let playerPrevMoveIndex;
let enemyPrevMoveIndex;
let enemyNextMoveIndex;
let enemyNextMoveTicks;
let shuffleTicks;
let shuffleCount;
let penaltyIndex;
let penaltyTicks;
let multiplier;
let combo = 0; // number of cards the player placed in a row before the AI placed one
const cardIntervalX = 15;
const cardRowCount = 5;
const cardColumnCount = 5;

function update() {
  if (!ticks) {
    // The 2 cards that are in the middle of the board
    placedCardNumbers = [2, 12];
    placedCards = times(2, (i) => {
      const pos = vec(calcPlacedCardX(i), 0);
      const tPos = vec(pos);
      return { num: placedCardNumbers[i], pos, tPos };
    });
    // Cards available to the player
    playerCards = times(cardColumnCount * cardRowCount, (i) => {
      const gPos = vec(i % cardColumnCount, floor(i / cardColumnCount));
      // row 0 gets set cards, random after that (Jack's Note: row 0 no longer gets set cards to randomize everything)
      const num = rndi(1, 14);
      const pos = calcPlayerCardPos(gPos);
      const tPos = vec(pos);
      return { num, pos, tPos, gPos };
    });
    // Cards available to the bot
    enemyCards = times(cardColumnCount * cardRowCount, (i) => {
      const gPos = vec(i % cardColumnCount, floor(i / cardColumnCount));
      const num = rndi(1, 14);
      const pos = calcEnemyCardPos(gPos);
      const tPos = vec(pos);
      return { num, pos, tPos, gPos };
    });
    centerY = targetCenterY = 40;
    playerPrevMoveIndex = enemyPrevMoveIndex = 0;
    enemyNextMoveIndex = undefined;
    enemyNextMoveTicks = 120;
    shuffleTicks = shuffleCount = 0;
    penaltyTicks = -1;
    multiplier = 1;
  }
  shuffleTicks++;
  if (shuffleTicks > 60) {
    // Check if there vaild cards to place
    let isPlacable = false;
    let isPlayerPlacable = false;
    for (let i = 0; i < cardColumnCount; i++) {
      // For each of the columns, check if there is a vaild card for the player
      const [pi, cn, ci] = checkPlacedIndex(
        i,
        playerPrevMoveIndex,
        playerCards
      );
      if (pi >= 0) {
        isPlacable = isPlacable = true;
        break;
      }
      // For each of the columns, check if there is a vaild card for the enemy
      const [epi, ecn, eci] = checkPlacedIndex(
        i,
        enemyPrevMoveIndex,
        enemyCards
      );
      if (epi >= 0) {
        isPlacable = true;
        break;
      }
    }
    // If the player has no cards to place, reduce the time befoer the enemy's next move
    if (!isPlayerPlacable) {
      enemyNextMoveTicks *= 0.3;
    }
    shuffleCount++;
    // If no cards are placeable or nothing happened for a long time,
    // Generate two new random cards to be in the middle
    if (!isPlacable || shuffleCount > 2) {
      play("powerUp");
      placedCards.forEach((c) => {
        c.tPos.x = c.pos.x < 50 ? -50 : 150;
      });
      placedCardNumbers = times(2, () => rndi(1, 14));
      placedCardNumbers.forEach((n, i) => {
        placedCards.push({
          num: n,
          pos: vec(i === 0 ? -5 : 105, 0),
          tPos: vec(calcPlacedCardX(i), 0),
        });
      });
      shuffleCount = 0;
    }
    shuffleTicks = 0;
  }
  const pci = floor((input.pos.x - 50) / cardIntervalX + cardColumnCount / 2);
  // if player pressed on a card
  if (input.isJustPressed) {
    if (pci >= 0 && pci < cardColumnCount) {
      // attempt to place card
      const pi = placeCard(pci, playerPrevMoveIndex, playerCards);
      // invalid move, save column and start punishment for 60 ticks
      if (pi < 0) {
        play("hit");
        penaltyIndex = pci;
        penaltyTicks = 60;
        targetCenterY += 5;
        multiplier = 1;
        shuffleTicks = shuffleCount = 0;
        // successful move
      } else {
        play("coin");
        playerPrevMoveIndex = pi;
        // add to the combo count when the player places a card
        combo++;
        // if the combo is high enough, move cards higher
        targetCenterY -= 10;
        if (combo >= 3) {
          targetCenterY -= 20;
        }
        addScore(multiplier, pi === 0 ? 8 : 92, centerY);
        multiplier++;
      }
    } else {
      for (let i = 0; i < 5; i++) {
        replaceCard(i, playerPrevMoveIndex, playerCards);
      }
    }
  }
  // if it's time for the enemy to make a move
  enemyNextMoveTicks--;
  if (enemyNextMoveTicks < 0) {
    enemyNextMoveTicks = rnd(50, 70) / sqrt(difficulty);
    // if there's a move to do
    if (enemyNextMoveIndex != null) {
      const [pi, cn, ci] = checkPlacedIndex(
        enemyNextMoveIndex,
        enemyPrevMoveIndex,
        enemyCards
      );
      // uncsuccesful move
      if (pi < 0) {
        enemyNextMoveTicks *= 3;
      }
      // valid move
      else {
        play("select");
        placeCard(enemyNextMoveIndex, enemyPrevMoveIndex, enemyCards);
        enemyPrevMoveIndex = pi;
        targetCenterY += 5;
        multiplier = 1;
        combo = 0; // when the enemy places card, reset the the player's combo
      }
    }
    // loop through all the columns to find a valid move
    enemyNextMoveIndex = undefined;
    let ni = rndi(cardColumnCount);
    for (let i = 0; i < cardColumnCount; i++) {
      const [pi, cn, ci] = checkPlacedIndex(ni, enemyPrevMoveIndex, enemyCards);
      if (pi >= 0) {
        if (pi !== enemyPrevMoveIndex) {
          enemyNextMoveTicks *= 1.5;
        }
        enemyNextMoveIndex = ni;
        break;
      }
      ni = wrap(ni + 1, 0, cardColumnCount);
    }
  }
  // display the gradual scrolling effect
  centerY += (targetCenterY - centerY) * 0.1;
  playerCards.forEach((c) => {
    movePos(c.pos, c.tPos, 0.2);
    const ec = c.gPos.y === 0 && c.gPos.x === pci ? "green" : undefined;
    drawCard(c.pos.x, c.pos.y + centerY, c.num, c.gPos.y, ec);
  });
  enemyCards.forEach((c) => {
    movePos(c.pos, c.tPos, 0.2);
    const ec =
      c.gPos.y === 0 && c.gPos.x === enemyNextMoveIndex ? "red" : undefined;
    drawCard(c.pos.x, c.pos.y + centerY, c.num, c.gPos.y, ec);
  });
  placedCards.forEach((c) => {
    movePos(c.pos, c.tPos, 0.2);
    drawCard(c.pos.x, c.pos.y + centerY, c.num, 0);
  });
  if (placedCards.length > 19) {
    placedCards.shift();
  }
  if (penaltyTicks > 0) {
    penaltyTicks--;
    color("red");
    text("X", calcCardX(penaltyIndex), centerY + 6);
    color("black");
  }
  if (targetCenterY < 16) {
    targetCenterY += (16 - targetCenterY) * 0.1;
  }
  // if you lose
  // Mika's note: i added the win condition (centerY < 6), wasn't there before
  if (centerY > 94 || centerY < 6) {
    play("explosion");
    end();
  }

  function placeCard(idx, ppi, cards) {
    const [pi, cn, ci] = checkPlacedIndex(idx, ppi, cards);
    if (pi === -1) {
      return -1;
    }
    placedCardNumbers[pi] = cn;
    const c = cards.splice(ci, 1)[0];
    placedCards.push({
      num: c.num,
      pos: c.pos,
      tPos: vec(calcPlacedCardX(pi), 0),
    });
    cards.forEach((c) => {
      if (c.gPos.x === idx) {
        c.gPos.y--;
        c.tPos =
          cards === playerCards
            ? calcPlayerCardPos(c.gPos)
            : calcEnemyCardPos(c.gPos);
      }
    });
    const gPos = vec(idx, cardRowCount - 1);
    const pos =
      cards === playerCards ? calcPlayerCardPos(gPos) : calcEnemyCardPos(gPos);
    const tPos = vec(pos);
    cards.push({ num: rndi(1, 14), pos, tPos, gPos });
    shuffleTicks = shuffleCount = 0;
    return pi;
  }

  // Jack's note: don't fully know how this works, but removes the top card of a given column. probably inefficient :)
  function replaceCard(idx, ppi, cards) {
    const [pi, cn, ci] = checkPlacedIndex(idx, ppi, cards);
    const c = cards.splice(ci, 1)[0];
    cards.forEach((c) => {
      if (c.gPos.x === idx) {
        c.gPos.y--;
        c.tPos = 
          cards === playerCards
            ? calcPlayerCardPos(c.gPos)
            : calcEnemyCardPos(c.gPos);
      }
    })
    const gPos = vec(idx, cardRowCount - 1);
    const pos =
      cards === playerCards ? calcPlayerCardPos(gPos) : calcEnemyCardPos(gPos);
    const tPos = vec(pos);
    cards.push({ num: rndi(1, 14), pos, tPos, gPos });
  }

  function checkPlacedIndex(idx, ppi, cards) {
    let cn;
    let ci;
    cards.forEach((c, i) => {
      if (c.gPos.y === 0 && c.gPos.x === idx) {
        cn = c.num;
        ci = i;
      }
    });
    let pi = -1;
    placedCardNumbers.forEach((c, i) => {
      if (
        (ppi === 1 || pi === -1) &&
        (cn === wrap(c - 1, 1, 14) || cn === wrap(c + 1, 1, 14))
      ) {
        pi = i;
      }
    });
    return [pi, cn, ci];
  }

  function drawCard(x, y, n, gy, edgeColor = undefined) {
    if (y < -5 || y > 105) {
      return;
    }
    const ec =
      edgeColor != null ? edgeColor : gy === 0 ? "black" : "light_black";
    color(ec);
    box(x, y, 9, 10);
    color("white");
    box(x, y, 7, 8);
    const nc = gy === 0 ? "black" : "light_black";
    color(nc);
    if (n === 10) {
      char("a", x, y);
    } else {
      text(numChars[n], x, y);
    }
  }

  function calcPlayerCardPos(p) {
    return vec(calcCardX(p.x), (p.y + 1) * 11);
  }

  function calcEnemyCardPos(p) {
    return vec(calcCardX(p.x), (p.y + 1) * -11);
  }

  function calcPlacedCardX(i) {
    return 50 + (i - 0.5) * 25;
  }

  function calcCardX(i) {
    return 50.5 + (i - cardColumnCount / 2 + 0.5) * cardIntervalX;
  }

  function movePos(p, tp, ratio) {
    p.add(vec(tp).sub(p).mul(ratio));
    if (p.distanceTo(tp) < 1) {
      p.set(tp);
    }
  }
}
