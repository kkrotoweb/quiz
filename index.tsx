import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, User, Play, Save, Upload, Star, Zap, Clock, 
  Brain, Target, Flame, ChevronRight, XCircle, CheckCircle2, Award, Globe
} from 'lucide-react';

// ============================================================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================================================
const APP_NAME = "DUVIDO QUE SAIBA!";
const API_KEY = ""; // Injetado pelo ambiente
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
const RANKING_API_URL = "https://script.google.com/macros/s/AKfycbwzPFVBjR_94zMZUdBWS3lDfBO7q9cE1pZ4Dm3w4r4FdNxbLMm2W5F9hH2CO_8WjBMX/exec";
const RANKING_SECRET = "DUVIDO_SEC_2026";

const SUGGESTED_THEMES = [
  "Dragon Ball", "Naruto", "One Piece", "Pokémon", "Cartoon Network", 
  "Fox Kids", "Cinema", "Filmes", "Músicas", "Rock", "Economia", 
  "Ciência", "Matemática", "Física", "Química", "Biologia", "História", 
  "Geografia", "Astronomia", "Tecnologia", "Programação", "Anos 80", 
  "Anos 90", "Novelas", "Séries", "Marvel", "DC", "Jogos", "Nintendo", 
  "PlayStation", "Xbox", "Mitologia", "RPG"
];

const DIFFICULTIES = ["Muito Fácil", "Fácil", "Normal", "Difícil", "Especialista"];

const WELCOME_TEXT = `Bem-vindo ao ${APP_NAME}\n\nAqui você escolhe o assunto e desafia seus próprios conhecimentos. Explore desde temas amplos como filmes, músicas, ciência e história até universos específicos como Dragon Ball, Naruto, Pokémon, Cartoon Network, séries dos anos 80, economia, programação e muito mais. Quer testar o quanto sabe ou estudar de forma divertida? Escolha qualquer tema, enfrente perguntas cada vez mais desafiadoras, acumule experiência, evolua seu nível e descubra até onde sua inteligência pode chegar.`;

// ============================================================================
// 2. UTILS E ENGINES (Lógica de Negócios)
// ============================================================================
class XPEngine {
  // Curva de XP: 50 * nivel^1.35
  static getRequiredXpForLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.35));
  }

  // Ganho progressivo
  static getXpGain(level, difficulty) {
    const diffMultiplier = DIFFICULTIES.indexOf(difficulty) + 1; // 1 a 5
    // Base gain increments slightly per level, boosted by difficulty
    const baseGain = 1 + ((level - 1) * 0.5); 
    return Math.floor(baseGain * (1 + (diffMultiplier * 0.2)));
  }
}

// ============================================================================
// 3. SERVIÇOS (IA e Storage)
// ============================================================================
class AIService {
  static async generateQuestion(theme, difficulty, historyContext = []) {
    const prompt = `
      Você é o motor de um jogo de trivia. Você NUNCA conversa, NUNCA explica, NUNCA faz comentários.
      Gere UMA pergunta sobre o tema: "${theme}". Dificuldade: ${difficulty}.
      
      HISTÓRICO DE FATOS JÁ COBRADOS DO JOGADOR (FINGERPRINTS SEMÂNTICOS):
      ${historyContext.length > 0 ? historyContext.map(f => `- ${f}`).join('\n') : 'Nenhum histórico. Primeira pergunta.'}
      
      REGRA ABSOLUTA DE INEDITISMO:
      O sistema verifica originalidade por SEMÂNTICA. Uma pergunta NUNCA pode avaliar o mesmo conhecimento do histórico.
      A repetição é PROIBIDA mesmo que:
      - A ordem das palavras seja diferente.
      - Existam sinônimos.
      - As alternativas sejam diferentes.
      - A resposta correta esteja em outra posição.
      
      AUTO-VALIDAÇÃO INTERNA (Execute antes de responder):
      1. Esta pergunta já apareceu literalmente no histórico?
      2. Ela mede o mesmo conhecimento de outra pergunta do histórico?
      3. A resposta correta é a mesma de outra pergunta equivalente?
      4. Apenas reescrevi uma pergunta antiga?
      Se a resposta for "SIM" para qualquer uma, DESCARTE E CRIE OUTRA. Repita esse processo até encontrar um fato totalmente inédito.
      
      Regras de formatação:
      - Exatamente 4 alternativas (A, B, C, D).
      - Apenas 1 resposta correta.
      - A explicação deve focar apenas no fato que torna a resposta correta. MÁXIMO ABSOLUTO de 150 caracteres.
      
      Retorne APENAS um JSON válido neste formato (sem marcações markdown):
      {
        "question": "Texto da pergunta inédita",
        "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
        "correctIndex": 0,
        "explanation": "Explicação curta de no máximo 150 caracteres.",
        "fingerprint": "Assinatura do fato central cobrado (ex: Derrota de Freeza por Goku em Namekusei). Máximo 10 palavras."
      }
    `;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    // Retry logic com Exponential Backoff
    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) throw new Error("Empty Response");
        
        return JSON.parse(textResponse);
      } catch (err) {
        retries--;
        if (retries === 0) throw new Error("Falha ao contatar a IA após múltiplas tentativas. Tente novamente.");
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }
}

class StorageService {
  static save(playerData) {
    try {
      const jsonStr = JSON.stringify(playerData);
      // Criptografia Simples + Base64 (Ofuscação)
      const encoded = btoa(encodeURIComponent(jsonStr)).split('').reverse().join('');
      const blob = new Blob([encoded], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `duvido_que_saiba_save_${new Date().getTime()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Erro ao salvar o progresso.");
    }
  }

  static async load(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const decoded = decodeURIComponent(atob(content.split('').reverse().join('')));
          resolve(JSON.parse(decoded));
        } catch (err) {
          reject("Arquivo de save inválido ou corrompido.");
        }
      };
      reader.onerror = () => reject("Erro ao ler o arquivo.");
      reader.readAsText(file);
    });
  }
}

class RankingService {
  static async saveScore(player, theme, playTimeSeconds) {
    try {
      const payload = {
        secret: RANKING_SECRET,
        nome: player.name,
        pontuacao: player.totalXp,
        acertos: player.correct,
        erros: player.incorrect,
        tema: theme,
        tempo: playTimeSeconds,
        dataHora: new Date().toLocaleString('pt-BR')
      };

      await fetch(RANKING_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Erro interno ao sincronizar ranking", e);
    }
  }

  static async getRanking() {
    const res = await fetch(RANKING_API_URL);
    return await res.json();
  }
}

// ============================================================================
// 4. UI COMPONENTS (Design System)
// ============================================================================
const GlassPanel = ({ children, className = "" }) => (
  <div className={`bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, icon: Icon }) => {
  const base = "relative overflow-hidden font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-95";
  const variants = {
    primary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    success: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/30",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} px-6 py-3 ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const XPBar = ({ xp, requiredXp, animated = true }) => {
  const percentage = Math.min(100, Math.max(0, (xp / requiredXp) * 100));
  
  return (
    <div className="w-full relative group">
      <div className="flex justify-between text-xs text-gray-400 mb-1 font-medium">
        <span>XP Atual</span>
        <span>{Math.floor(xp)} / {requiredXp}</span>
      </div>
      <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div 
          className={`h-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] relative ${animated ? 'transition-all duration-1000 ease-out' : ''}`}
          style={{ width: `${percentage}%` }}
        >
          {/* Brilho interno */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. TELAS DO JOGO
// ============================================================================

const ScreenHome = ({ player, setPlayer, onStartGame, setScreen }) => {
  const [name, setName] = useState(player.name);
  const [theme, setTheme] = useState("");
  const [difficulty, setDifficulty] = useState("Normal");
  const fileInputRef = useRef(null);

  const handleStart = () => {
    if (!name.trim()) return;
    localStorage.setItem('duvidoNome', name.trim());
    setPlayer(p => ({ ...p, name: name.trim() }));
    onStartGame(theme.trim() || "Conhecimentos Gerais", difficulty);
  };

  const handleLoad = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await StorageService.load(file);
      if (data && data.level) {
        setPlayer(data);
        alert("Progresso carregado com sucesso!");
      }
    } catch (err) {
      alert(err);
    }
    e.target.value = null; // Reset
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-5xl mx-auto w-full gap-8 animate-in fade-in duration-700">
      
      {/* Header Profile Mini */}
      <div className="w-full flex justify-between items-center bg-gray-900/40 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
            <User className="text-indigo-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">{player.name || "Jogador(a)"}</h3>
            <p className="text-indigo-400 text-sm font-medium">Nível {player.level}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setScreen('ranking')} icon={Globe} className="!py-2 !px-4 text-sm">
            Ranking
          </Button>
          <Button variant="secondary" onClick={() => setScreen('profile')} icon={User} className="!py-2 !px-4 text-sm">
            Perfil
          </Button>
          <Button variant="secondary" onClick={() => setScreen('achievements')} icon={Trophy} className="!py-2 !px-4 text-sm">
            Conquistas
          </Button>
        </div>
      </div>

      <div className="text-center space-y-4 mb-4">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-[0_0_25px_rgba(129,140,248,0.2)]">
          {APP_NAME}
        </h1>
        <p className="text-gray-400 text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto">
          O Quiz infinito gerado por Inteligência Artificial.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Lado Esquerdo - Boas Vindas */}
        <GlassPanel className="p-8 flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Sobre o Jogo</h2>
          </div>
          <p className="text-gray-300 leading-relaxed whitespace-pre-line text-[15px]">
            {WELCOME_TEXT}
          </p>
        </GlassPanel>

        {/* Lado Direito - Controles */}
        <GlassPanel className="p-8 flex flex-col gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400 ml-1">Seu Nome</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 ml-1">Qual assunto deseja jogar?</label>
            <input 
              type="text" 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Dragon Ball, Economia, Mitologia..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-lg"
            />
            
            {/* Sugestões */}
            <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-1">
              {SUGGESTED_THEMES.map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="text-xs bg-white/5 hover:bg-white/15 border border-white/5 px-3 py-1.5 rounded-full text-gray-300 transition-all active:scale-95"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium text-gray-400 ml-1">Dificuldade</label>
             <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DIFFICULTIES.map(diff => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`text-xs py-2 rounded-lg font-medium transition-all ${
                      difficulty === diff 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
             </div>
          </div>

          <Button onClick={handleStart} icon={Play} className="w-full mt-2 py-4 text-lg">
            INICIAR DESAFIO
          </Button>

          <div className="flex items-center gap-4 mt-2 pt-4 border-t border-white/5">
            <Button variant="secondary" onClick={() => StorageService.save(player)} icon={Save} className="flex-1 text-sm">
              Salvar
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current.click()} icon={Upload} className="flex-1 text-sm">
              Carregar
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".txt"
              onChange={handleLoad}
            />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};

const ScreenGame = ({ theme, difficulty, onQuit, player, onUpdatePlayer }) => {
  const [questionData, setQuestionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null); // { oldLevel, newLevel }
  const [startTime] = useState(Date.now());

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedOpt(null);
    setIsAnswered(false);
    setLevelUpData(null);
    
    try {
      // Passando o histórico permanente de fingerprints para a IA
      const data = await AIService.generateQuestion(theme, difficulty, player.questionHistory || []);
      setQuestionData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [theme, difficulty, player.questionHistory]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  const handleAnswer = (index) => {
    if (isAnswered) return;
    
    setSelectedOpt(index);
    setIsAnswered(true);

    const isCorrect = index === questionData.correctIndex;
    
    // Atualizar Player Status e adicionar Fingerprint ao histórico semântico
    onUpdatePlayer(prev => {
      let newStats = { ...prev };
      
      // Inicia o histórico caso ainda não exista (jogadores antigos)
      if (!newStats.questionHistory) {
        newStats.questionHistory = [];
      }
      
      // Armazena a assinatura semântica para nunca mais repetir
      if (questionData.fingerprint) {
        newStats.questionHistory.push(questionData.fingerprint);
      }
      
      newStats.gamesPlayed += 1;
      
      if (isCorrect) {
        newStats.correct += 1;
        newStats.streak += 1;
        if (newStats.streak > newStats.maxStreak) {
          newStats.maxStreak = newStats.streak;
        }
        
        // Ganho de XP
        const xpGain = XPEngine.getXpGain(newStats.level, difficulty);
        newStats.xp += xpGain;
        newStats.totalXp += xpGain;
        
        // Level up check
        let required = XPEngine.getRequiredXpForLevel(newStats.level);
        if (newStats.xp >= required) {
          setLevelUpData({ oldLevel: newStats.level, newLevel: newStats.level + 1 });
          newStats.xp = newStats.xp - required; // Carrega sobra
          newStats.level += 1;
        }
      } else {
        newStats.incorrect += 1;
        newStats.streak = 0;
      }
      
      return newStats;
    });
  };

  const handleQuitGame = async () => {
    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
    await RankingService.saveScore(player, theme, timeElapsed);
    onQuit();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 max-w-4xl mx-auto w-full animate-in slide-in-from-bottom-8 duration-500">
      
      {/* Top Bar Game */}
      <div className="w-full flex items-center justify-between bg-gray-900/60 p-4 rounded-2xl mb-8 border border-white/5">
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-xs text-gray-400 font-medium">Tema Atual</p>
            <h3 className="font-bold text-white text-lg truncate max-w-[200px]">{theme}</h3>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2"></div>
          <div className="text-left">
             <p className="text-xs text-gray-400 font-medium">Dificuldade</p>
             <h3 className="font-semibold text-indigo-400">{difficulty}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="text-right hidden sm:block">
             <p className="text-xs text-gray-400 font-medium">Sequência</p>
             <div className="flex items-center justify-end gap-1 text-orange-400 font-bold">
               <Flame size={16} /> {player.streak}
             </div>
           </div>
           <Button variant="secondary" onClick={handleQuitGame} className="!py-2 !px-4 text-sm" icon={XCircle}>
             Sair
           </Button>
        </div>
      </div>

      {/* Progress Bar (XP) */}
      <div className="w-full mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Star className="text-emerald-400" size={20} />
          </div>
          <h2 className="text-xl font-bold text-white">Nível {player.level}</h2>
        </div>
        <XPBar xp={player.xp} requiredXp={XPEngine.getRequiredXpForLevel(player.level)} />
      </div>

      {/* Area da Pergunta */}
      <GlassPanel className="w-full p-6 md:p-10 relative overflow-hidden">
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-indigo-400 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-medium animate-pulse">A IA está formulando um desafio...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <XCircle className="text-red-500 mx-auto mb-4" size={48} />
            <h3 className="text-xl text-white mb-2">Ops, ocorreu um erro.</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={fetchQuestion} icon={Play}>Tentar Novamente</Button>
          </div>
        )}

        {!loading && !error && questionData && (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl md:text-3xl font-semibold text-white leading-tight mb-10 text-center">
              {questionData.question}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {questionData.options.map((opt, idx) => {
                const isSelected = selectedOpt === idx;
                const isCorrect = questionData.correctIndex === idx;
                
                let btnStyle = "bg-white/5 border-white/10 hover:bg-white/10 text-gray-200";
                
                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle = "bg-green-500/20 border-green-500/50 text-green-300 ring-2 ring-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]";
                  } else if (isSelected && !isCorrect) {
                    btnStyle = "bg-red-500/20 border-red-500/50 text-red-300";
                  } else {
                    btnStyle = "bg-black/20 border-white/5 text-gray-600 opacity-50"; // Opções não escolhidas
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={isAnswered}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-300 text-lg flex items-center justify-between group ${btnStyle} ${!isAnswered ? 'active:scale-[0.98]' : ''}`}
                  >
                    <span className="flex items-center gap-4">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/30 font-bold text-sm text-gray-400 group-hover:text-white transition-colors">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </span>
                    
                    {isAnswered && isCorrect && <CheckCircle2 className="text-green-500" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="text-red-500" />}
                  </button>
                );
              })}
            </div>

            {/* Area de Resultado e Explicação */}
            {isAnswered && (
              <div className="mt-8 pt-8 border-t border-white/10 animate-in slide-in-from-bottom-4 flex flex-col items-center text-center">
                
                {/* Level UP Overlay */}
                {levelUpData && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-500" onClick={() => setLevelUpData(null)}>
                     <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-12 rounded-3xl border border-indigo-400 shadow-[0_0_50px_rgba(99,102,241,0.5)] text-center transform scale-110">
                        <Star className="text-yellow-400 mx-auto mb-4 animate-bounce" size={64} fill="currentColor" />
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-2">LEVEL UP!</h1>
                        <p className="text-2xl text-white font-medium">Você alcançou o Nível {levelUpData.newLevel}</p>
                        <p className="text-indigo-200 mt-6 text-sm">Clique em qualquer lugar para continuar</p>
                     </div>
                  </div>
                )}

                {selectedOpt === questionData.correctIndex ? (
                  <div className="flex items-center gap-2 text-green-400 font-bold text-2xl mb-4">
                    <CheckCircle2 size={32} /> Resposta Correta!
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-500 font-bold text-2xl mb-4">
                    <XCircle size={32} /> Que pena, você errou!
                  </div>
                )}

                <p className="text-gray-300 font-medium max-w-2xl bg-black/30 p-4 rounded-xl border border-white/5 text-left md:text-center">
                  {selectedOpt !== questionData.correctIndex && (
                    <strong className="text-indigo-300 block mb-2 border-b border-white/10 pb-2">
                      A alternativa correta era: {String.fromCharCode(65 + questionData.correctIndex)}
                    </strong>
                  )}
                  {questionData.explanation}
                </p>

                <Button onClick={fetchQuestion} className="mt-8 w-full md:w-auto px-12 py-4 text-lg" icon={ChevronRight}>
                  PRÓXIMA PERGUNTA
                </Button>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

const ScreenRanking = ({ onBack }) => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRanking = async () => {
    try {
      const data = await RankingService.getRanking();
      setRanking(data);
    } catch (err) {
      console.error("Erro ao carregar o ranking:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
    // Atualiza automaticamente a cada 30 segundos
    const interval = setInterval(fetchRanking, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-5xl mx-auto w-full animate-in slide-in-from-right-8 duration-500">
      <Button variant="secondary" onClick={onBack} className="self-start mb-6 !py-2" icon={ChevronRight}>
        Voltar
      </Button>

      <GlassPanel className="p-8 flex-1">
        <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
          <Globe className="text-blue-400" size={32} /> Ranking Global
        </h1>
        <p className="text-gray-400 mb-8">Os 100 melhores jogadores do mundo. Atualizado a cada 30 segundos.</p>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-medium">Nenhum registro encontrado. Seja o primeiro a jogar!</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-white/5 text-gray-300 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold text-center rounded-tl-xl w-24">Posição</th>
                  <th className="p-4 font-semibold">Nome</th>
                  <th className="p-4 font-semibold text-center">Pontuação</th>
                  <th className="p-4 font-semibold text-center">Acertos</th>
                  <th className="p-4 font-semibold text-center">Erros</th>
                  <th className="p-4 font-semibold">Tema Favorito</th>
                  <th className="p-4 font-semibold text-center rounded-tr-xl">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ranking.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors text-gray-200">
                    <td className="p-4 text-center font-bold text-lg">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                    </td>
                    <td className="p-4 font-bold text-white">{row.nome}</td>
                    <td className="p-4 text-center text-indigo-400 font-bold">{row.pontuacao}</td>
                    <td className="p-4 text-center text-green-400 font-medium">{row.acertos}</td>
                    <td className="p-4 text-center text-red-400 font-medium">{row.erros}</td>
                    <td className="p-4 text-sm text-gray-400 truncate max-w-[120px]">{row.tema}</td>
                    <td className="p-4 text-center text-xs text-gray-400">{formatTime(row.tempo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
};


// ============================================================================
// 6. MAIN APP (State Router)
// ============================================================================
export default function App() {
  const [screen, setScreen] = useState('home'); // home, game, profile, achievements, ranking
  const [gameConfig, setGameConfig] = useState({ theme: "", difficulty: "Normal" });
  
  // Estado Global do Jogador
  const [player, setPlayer] = useState(() => {
    const savedName = localStorage.getItem('duvidoNome');
    return {
      name: savedName || "",
      level: 1,
      xp: 0,
      totalXp: 0,
      correct: 0,
      incorrect: 0,
      streak: 0,
      maxStreak: 0,
      gamesPlayed: 0,
      questionHistory: [] // Armazena permanentemente os fingerprints semânticos
    };
  });

  const handleStartGame = (theme, difficulty) => {
    setGameConfig({ theme, difficulty });
    setScreen('game');
  };

  return (
    <div className="min-h-screen bg-gray-950 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* Background Decorativo (Gradients & Orbs) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/30 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] mix-blend-screen"></div>
      </div>

      {/* Roteamento Interno */}
      <div className="relative z-10 w-full h-full">
        {screen === 'home' && (
          <ScreenHome 
            player={player} 
            setPlayer={setPlayer} 
            onStartGame={handleStartGame} 
            setScreen={setScreen}
          />
        )}
        
        {screen === 'game' && (
          <ScreenGame 
            theme={gameConfig.theme}
            difficulty={gameConfig.difficulty}
            player={player}
            onUpdatePlayer={setPlayer}
            onQuit={() => setScreen('home')}
          />
        )}

        {screen === 'profile' && (
          <ScreenProfile 
            player={player}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'achievements' && (
          <ScreenAchievements 
            player={player}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'ranking' && (
          <ScreenRanking 
            onBack={() => setScreen('home')}
          />
        )}
      </div>
    </div>
  );
}