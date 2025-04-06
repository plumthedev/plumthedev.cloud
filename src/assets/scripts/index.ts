(() => {
    const bottomLeftWave = document.querySelector<HTMLDivElement>('.bg-wave-bottom-left')!;
    const topRightWave = document.querySelector<HTMLDivElement>('.bg-wave-top-right')!;

    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        topRightWave.style.transform = `translate(calc(102.5% + ${x * 40}px), calc(-2.5% + ${y * 20}px))`;
        bottomLeftWave.style.transform = `translate(calc(-2.5% + ${x * 20}px), calc(102.5% + ${y * 20}px))`;
    });

    let typed = '';
    const secret = ['Y2', 'h1', 'Y2', 's='].join('');
    let resetTimeout: ReturnType<typeof setTimeout>;

    document.addEventListener('keydown', (e) => {
        clearTimeout(resetTimeout);

        typed += e.key.toLowerCase();
        typed = typed.slice(-secret.length);

        if (btoa(typed) === secret) {
            window.location.href = atob('cHJvdG9jb2wtYy5odG1s');
        }

        resetTimeout = setTimeout(() => {
            typed = '';
        }, 3000);
    });
})()
