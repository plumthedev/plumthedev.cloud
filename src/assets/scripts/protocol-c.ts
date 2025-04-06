(() => {
    const gameBoardEl = document.getElementById("game-board")!;
    const menuEl = document.getElementById("menu")!;
    const playerEl = document.getElementById("player")!;
    const obstaclesEl = document.getElementById("obstacles")!;
    const scoreEl = document.getElementById("score")!;
    const highScoreEl = document.getElementById("high-score")!;
    let isGameStarted = false;
    let gameStartedAt = Date.now();
    let isGameOver = false;
    let jumping = false;
    let obstaclesCount = 0;
    let score = 0;
    let highScore = Number(localStorage.getItem('high-score') || 0);
    let scoreMultiplier = 1;

    updateScore(0)

    document.addEventListener("keydown", e => {
        if (!isGameStarted) {
            startGame();
            return;
        }

        if (e.code === "Space" && !jumping && !isGameOver) {
            jump();
        }
    });

    function jump() {
        jumping = true;
        playerEl.classList.add("jumping");

        setTimeout(() => {
            playerEl.classList.remove("jumping");
            jumping = false;
        }, 750);
    }


    function createObstacle() {
        if (obstaclesCount >= 1) {
            return;
        }

        const obstacle = document.createElement("div");
        const speed = Math.max(800, 3000 - Math.log(score + 1) * 300);

        obstacle.classList.add("obstacle");
        obstacle.textContent = "🍗";
        obstacle.style.animationDuration = `${speed}ms`;
        obstaclesEl.appendChild(obstacle);
        obstaclesCount++;

        const moveObstacleInterval = setInterval(() => {
            const obstaclePosition = obstacle.getBoundingClientRect();
            const playerPosition = playerEl.getBoundingClientRect();

            if (
                obstaclePosition.left < playerPosition.right &&
                obstaclePosition.right > playerPosition.left &&
                obstaclePosition.bottom > playerPosition.top &&
                obstaclePosition.top < playerPosition.bottom
            ) {
                gameOver();
                obstacle.remove();
                clearInterval(moveObstacleInterval);
            }

            if (obstaclePosition.right <= 0) {
                obstaclesCount--
                obstacle.remove();
                clearInterval(moveObstacleInterval);
            }
        }, 20);
    }

    function updateScore(score: number) {
        scoreEl.innerText = String(score);
        highScoreEl.innerText = String(score > highScore ? score : highScore);
    }

    function startGame() {
        if (isGameStarted) {
            return;
        }

        isGameOver = false;
        isGameStarted = true;
        gameStartedAt = Date.now();
        score = 0;
        updateScore(score);
        gameBoardEl.classList.remove('game-over')
        menuEl.style.display = 'none';

        const spawnObstaclesInterval = setInterval(() => {
            if (isGameOver) {
                clearInterval(spawnObstaclesInterval);
                return;
            }

            createObstacle();
        }, 1500);

        const scoreInterval = setInterval(() => {
            const gameplayLength = Math.floor((Date.now() - gameStartedAt) / 1000);
            scoreMultiplier = 1 + Math.floor(gameplayLength / 5);

            if (isGameOver) {
                clearInterval(scoreInterval);
                return;
            }

            score += scoreMultiplier
            updateScore(score);
        }, 100);
    }

    function gameOver() {
        if (isGameOver) {
            return;
        }

        isGameOver = true;
        isGameStarted = false;
        obstaclesCount = 0;
        highScore = Number(localStorage.getItem('high-score') || 0)
        gameBoardEl.classList.add('game-over')
        menuEl.style.display = 'flex';


        if (!highScore) {
            localStorage.setItem('high-score', String(score));
        }

        if (score > highScore) {
            highScore = score;
            localStorage.removeItem('high-score');
            localStorage.setItem('high-score', String(score));
        }
    }
})()
