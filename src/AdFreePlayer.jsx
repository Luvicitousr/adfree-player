import { useState, useRef, useEffect } from 'react';

export default function AdFreePlayer() {
    // Estados da interface
    // O estado já nasce lendo a URL. Se não tiver nada, nasce vazio ('').
    const [youtubeLink, setYoutubeLink] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('video') || '';
    });

    const [videoSrc, setVideoSrc] = useState(null);
    const [audioSrc, setAudioSrc] = useState(null);

    // Se o youtubeLink já nasceu com algo da URL, o loading já começa ativado!
    const [isLoading, setIsLoading] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return !!params.get('video');
    });

    const [error, setError] = useState('');
    const [resolution, setResolution] = useState('');

    // Referências para controlar os elementos nativos
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    const isBufferingWait = useRef(false);

    // A função de extração agora está isolada para ser chamada por humanos ou robôs
    const executarExtracao = async (linkOriginal) => {
        if (!linkOriginal.includes('youtube.com') && !linkOriginal.includes('youtu.be')) {
            setError('Por favor, insira um link válido do YouTube.');
            setIsLoading(false);
            return;
        }


        // Conexão direta com a máquina host, latência zero
        const serverUrl = 'http://localhost:3000';

        const response = await fetch(`${serverUrl}/api/extract?url=${encodeURIComponent(linkOriginal)}`);

        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        return data;
    };

    useEffect(() => {
        // Se não tiver link na URL, não faz nada
        if (!youtubeLink) return;

        // O React permite atualizações de estado DENTRO de blocos async após o "await"
        const iniciarAutomacao = async () => {
            try {
                const data = await executarExtracao(youtubeLink);
                setVideoSrc(data.videoUrl);
                setAudioSrc(data.audioUrl);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        iniciarAutomacao();
    }, []);

    // Acionado se você clicar no botão manualmente
    const handleExtract = async (e) => {
        e.preventDefault();

        setError('');
        setVideoSrc(null);
        setAudioSrc(null);
        setIsLoading(true);

        try {
            const data = await executarExtracao(youtubeLink);
            setVideoSrc(data.videoUrl);
            setAudioSrc(data.audioUrl);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- FUNÇÕES DE SINCRONIZAÇÃO DO PLAYER ---
    const checkSyncAndPlay = () => {
        const vid = videoRef.current;
        const aud = audioRef.current;
        if (!vid || !aud) return;

        // O readyState >= 3 significa que o arquivo tem dados baixados suficientes para tocar
        if (aud.readyState >= 3) {
            isBufferingWait.current = false; // Abaixa a bandeira

            // Força a cola magnética dos tempos se houver desvio de rede
            if (Math.abs(aud.currentTime - vid.currentTime) > 0.2) {
                aud.currentTime = vid.currentTime;
            }
            aud.play().catch(() => { });
        } else {
            // O Áudio engasgou na rede. Levantamos a bandeira e mandamos o vídeo parar e esperar.
            isBufferingWait.current = true;
            vid.pause();
        }
    };

    const handlePlay = () => {
        isBufferingWait.current = false;
        checkSyncAndPlay();
    };

    const handlePause = () => {
        if (isBufferingWait.current) return;
        if (audioRef.current) audioRef.current.pause();
    };

    const handleWaiting = () => {
        // O vídeo engasgou, para o áudio imediatamente.
        if (audioRef.current) audioRef.current.pause();
    };

    const handlePlaying = () => {
        checkSyncAndPlay();
    };

    // Pausa o áudio enquanto o usuário estiver arrastando a barra
    const handleSeeking = () => {
        if (audioRef.current) audioRef.current.pause();
    };

    const handleSeeked = () => {
        if (audioRef.current && videoRef.current) {
            audioRef.current.currentTime = videoRef.current.currentTime;
        }
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        const aud = audioRef.current;
        if (!vid || !aud) return;

        // Calcula a diferença de tempo entre o vídeo e o áudio
        const drift = Math.abs(vid.currentTime - aud.currentTime);

        // Se o desvio for maior que 0.25 segundos (250ms), força o realinhamento.
        if (drift > 0.25) {
            aud.currentTime = vid.currentTime;
        }
    };

    const handleAudioWaiting = () => {
        const vid = videoRef.current;
        if (vid && !vid.paused) {
            isBufferingWait.current = true;
            vid.pause();
        }
    };

    const handleAudioCanPlay = () => {
        const vid = videoRef.current; // O áudio terminou de carregar da rede. 
        if (vid && isBufferingWait.current) {
            isBufferingWait.current = false;
            vid.play().catch(() => { });
        }
    };



    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">

            {/* Cabeçalho */}
            <div className="max-w-3xl w-full space-y-8 text-center mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight text-white">
                    Player <span className="text-red-500">Sem Interrupções</span>
                </h1>
                <p className="text-gray-400 text-lg">
                    Cole o link abaixo. Nós extraímos o stream bruto para você assistir sem anúncios.
                </p>
            </div>

            {/* Formulário de Input */}
            <div className="max-w-2xl w-full bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-800">
                <form onSubmit={handleExtract} className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeLink}
                        onChange={(e) => setYoutubeLink(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${isLoading
                            ? 'bg-red-500/50 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700 active:scale-95'
                            }`}
                    >
                        {isLoading ? 'Extraindo...' : 'Assistir'}
                    </button>
                </form>

                {/* Mensagem de Erro */}
                {error && <p className="mt-4 text-sm text-red-400 text-center">{error}</p>}
            </div>

            {/* Área do Player de Vídeo */}
            <div className="max-w-4xl w-full mt-12">
                {isLoading && (
                    <div className="aspect-video bg-gray-900 rounded-2xl flex flex-col items-center justify-center border border-gray-800 shadow-2xl animate-pulse">
                        <div className="w-12 h-12 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-400 font-medium">Buscando o stream nos servidores do Google...</p>
                    </div>
                )}

                {videoSrc && !isLoading && (
                    <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">

                        {/* Badge flutuante com a resolução */}
                        {resolution && (
                            <div className="absolute top-4 left-4 z-10 bg-black/80 text-green-400 text-xs font-mono px-3 py-1 rounded-md border border-green-500/30 backdrop-blur-sm">
                                Resolução Real: {resolution}
                            </div>
                        )}

                        <video
                            ref={videoRef}
                            controls
                            autoPlay
                            className="w-full h-full object-contain focus:outline-none"
                            src={videoSrc}
                            onLoadedMetadata={(e) => {
                                setResolution(`${e.target.videoWidth}x${e.target.videoHeight}`);
                            }}
                            onTimeUpdate={handleTimeUpdate}

                            // Garante que o áudio acelere se o usuário mudar a velocidade do vídeo
                            onRateChange={(e) => {
                                if (audioRef.current) {
                                    audioRef.current.playbackRate = e.target.playbackRate;
                                }
                            }}

                            onLoadedData={(e) => {
                                if (e.target.currentTime === 0) {
                                    e.target.currentTime = 0.1;
                                }
                            }}
                            // Eventos de Sincronização
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onSeeking={handleSeeking}
                            onSeeked={handleSeeked}
                            onWaiting={handleWaiting}
                            onPlaying={handlePlaying}
                        />

                        {/* O Áudio fica embutido, mas oculto visualmente */}
                        {audioSrc && (
                            <audio
                                ref={audioRef}
                                src={audioSrc}
                                style={{ display: 'none' }}
                                onWaiting={handleAudioWaiting}
                                onCanPlay={handleAudioCanPlay} />
                        )}
                    </div>
                )}
            </div>

        </div >
    );
}