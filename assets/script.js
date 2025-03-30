(() => {
    const bottomLeftWave = document.querySelector('.bg-wave-bottom-left');
    const topRightWave = document.querySelector('.bg-wave-top-right');

    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        topRightWave.style.transform = `translate(calc(102.5% + ${x * 40}px), calc(-2.5% + ${y * 20}px))`;
        bottomLeftWave.style.transform = `translate(calc(-2.5% + ${x * 20}px), calc(102.5% + ${y * 20}px))`;
    });

    let buffer = '';
    const secret = 'chuck';
    let resetTimeout;

    document.addEventListener('keydown', (e) => {
        clearTimeout(resetTimeout);

        buffer += e.key.toLowerCase();
        buffer = buffer.slice(-secret.length);

        if (buffer === secret) {
            window.location.href = 'game.html';
        }

        resetTimeout = setTimeout(() => {
            buffer = '';
        }, 3000);
    });
})()
