(() => {
    const bottomLeftWave = document.querySelector<HTMLDivElement>('.bg-wave-bottom-left')!;
    const topRightWave = document.querySelector<HTMLDivElement>('.bg-wave-top-right')!;

    document.addEventListener('mousemove', (e) => {
        if (window.innerWidth <= 767) {
            return;
        }

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

    function loadGTM() {
        const id = 'GTM-KH64L7ZR';
        const gtmScript = document.createElement('script');
        gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
        gtmScript.async = true;
        document.head.appendChild(gtmScript);

        const noscript = document.createElement('noscript');
        noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.appendChild(noscript);
    }

    function cookies() {
        const banner = document.getElementById('cookies-banner')!;
        const accepted = localStorage.getItem('cookies') || '0';
        loadGTM();

        const hideBanner = () => {
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 1000);
        }

        if (accepted === '1') {
            hideBanner();
            return;
        }

        banner.style.opacity = '1';

        document.getElementById('accept-cookies')!.addEventListener('click', () => {
            localStorage.setItem('cookies', '1');
            loadGTM();
            hideBanner();
        });

        document.getElementById('reject-cookies')!.addEventListener('click', () => {
            localStorage.setItem('cookies', '0');
            hideBanner();
        });
    }

    cookies();
})()
