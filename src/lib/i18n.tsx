import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

  type Lang = "en" | "es";

  const translations = {
    en: {
      landing: {
        title: "H Love",
        subtitle: "Real humans. Real connections.",
        subtitle2: "Verified by World ID.",
        verify: "Verify with World ID",
        feature1: "100% Orb-verified humans only",
        feature2: "Premium connections, zero bots",
        feature3: "Exclusive events & meetups",
        feature4: "Safe, respectful community",
        requires: "Requires World App with Orb verification",
        authenticating: "Authenticating wallet...",
        verifying: "Verifying humanity...",
        saving: "Saving...",
        openInWorldApp: "Open this app inside World App",
        walletError: "Could not get your wallet. Try again.",
        walletAuthError: "Wallet authentication error",
        verifyCancelled: "Verification cancelled or failed",
        backendError: "Backend rejected the verification",
        verifiedNoWallet: "Verified but wallet not found. Try again.",
      },
      onboarding: {
        step1: "Who are you?",
        step2: "Tell us more",
        step3: "Show yourself",
        step4: "Preferences",
        displayName: "Display Name",
        displayNamePlaceholder: "How should people call you?",
        age: "Age",
        agePlaceholder: "Your age (18+)",
        gender: "Gender",
        male: "Male",
        female: "Female",
        other: "Other",
        aboutYou: "About you",
        aboutPlaceholder: "Tell people something interesting about yourself...",
        interests: "Interests",
        addPhotos: "Add up to {max} photos. First = main profile picture.",
        add: "Add",
        main: "Main",
        lookingFor: "Looking for",
        men: "Men",
        women: "Women",
        everyone: "Everyone",
        friends: "Friends",
        city: "City",
        cityPlaceholder: "Your city",
        back: "Back",
        next: "Next",
        complete: "Complete",
        errorSaving: "Error saving profile",
      },
      swipe: {
        noMore: "No more profiles",
        noMoreSub: "Check back later for new people in your area",
        likes: "likes",
        premiumProfile: "Premium Profile",
        upgradeToConnect: "Upgrade to connect",
        itsAMatch: "It's a Match!",
        youAndLiked: "You and {name} liked each other",
        keepSwiping: "Keep Swiping",
        sendMessage: "Send Message",
      },
      premium: {
        unlock: "Unlock Premium",
        description: "Get unlimited likes, see who likes you, boost your profile, and connect with exclusive members",
        unlimitedLikes: "Unlimited likes & super likes",
        seeWhoLiked: "See who already liked you",
        freeBoost: "1 free boost per week",
        priorityFeed: "Priority in the feed",
        upgrade: "Upgrade — 9.99 USDC/mo",
        maybeLater: "Maybe later",
        orWLD: "or pay with WLD",
      },
      matches: {
        title: "Matches",
        subtitle: "Your connections",
        noMatches: "No matches yet",
        noMatchesSub: "Start swiping to find your match",
        newMatch: "New",
        orbVerified: "Orb Verified",
      },
      events: {
        title: "Events",
        subtitle: "Meet verified humans in person",
        noEvents: "No upcoming events",
        noEventsSub: "Check back soon for new events",
        attending: "attending",
        youHaveTicket: "You have a ticket",
        soldOut: "Sold Out",
      },
      profile: {
        editProfile: "Edit Profile",
        save: "Save",
        saving: "Saving...",
        orbVerified: "Orb Verified",
        matches: "Matches",
        superLikes: "Super Likes",
        matchRate: "Match Rate",
        name: "Name",
        bio: "Bio",
        photos: "Photos",
        premium: "Premium",
        getPremium: "Get Premium",
        premiumMember: "Premium Member",
        boost: "Boost Profile",
        boostDesc: "Be seen by 10x more people for 30 minutes",
        logout: "Log Out",
        referral: "Invite friends",
      },
      chat: {
        startConvo: "Start the conversation!",
        saySomething: "Say something nice to {name}",
        typeMessage: "Type a message...",
        send: "Send",
      },
      nav: {
        discover: "Discover",
        matches: "Matches",
        events: "Events",
        profile: "Profile",
      },
      common: {
        loading: "Loading...",
        error: "Error",
        retry: "Retry",
        cancel: "Cancel",
        confirm: "Confirm",
        close: "Close",
      },
    },
    es: {
      landing: {
        title: "H Love",
        subtitle: "Humanos reales. Conexiones reales.",
        subtitle2: "Verificado por World ID.",
        verify: "Verificar con World ID",
        feature1: "100% humanos verificados con Orb",
        feature2: "Conexiones premium, cero bots",
        feature3: "Eventos y meetups exclusivos",
        feature4: "Comunidad segura y respetuosa",
        requires: "Requiere World App con verificación Orb",
        authenticating: "Autenticando wallet...",
        verifying: "Verificando humanidad...",
        saving: "Guardando...",
        openInWorldApp: "Abre esta app dentro de World App",
        walletError: "No se pudo obtener tu wallet. Intenta de nuevo.",
        walletAuthError: "Error al autenticar wallet",
        verifyCancelled: "Verificación cancelada o fallida",
        backendError: "El backend rechazó la verificación",
        verifiedNoWallet: "Verificado pero no se encontró wallet. Intenta de nuevo.",
      },
      onboarding: {
        step1: "¿Quién eres?",
        step2: "Cuéntanos más",
        step3: "Muéstrate",
        step4: "Preferencias",
        displayName: "Nombre",
        displayNamePlaceholder: "¿Cómo quieres que te llamen?",
        age: "Edad",
        agePlaceholder: "Tu edad (18+)",
        gender: "Género",
        male: "Hombre",
        female: "Mujer",
        other: "Otro",
        aboutYou: "Sobre ti",
        aboutPlaceholder: "Cuéntale a la gente algo interesante sobre ti...",
        interests: "Intereses",
        addPhotos: "Agrega hasta {max} fotos. La primera será tu foto principal.",
        add: "Agregar",
        main: "Principal",
        lookingFor: "Buscando",
        men: "Hombres",
        women: "Mujeres",
        everyone: "Todos",
        friends: "Amigos",
        city: "Ciudad",
        cityPlaceholder: "Tu ciudad",
        back: "Atrás",
        next: "Siguiente",
        complete: "Completar",
        errorSaving: "Error al guardar perfil",
      },
      swipe: {
        noMore: "No hay más perfiles",
        noMoreSub: "Vuelve después para ver nuevas personas",
        likes: "likes",
        premiumProfile: "Perfil Premium",
        upgradeToConnect: "Hazte premium para conectar",
        itsAMatch: "¡Es un Match!",
        youAndLiked: "Tú y {name} se gustaron",
        keepSwiping: "Seguir deslizando",
        sendMessage: "Enviar mensaje",
      },
      premium: {
        unlock: "Desbloquear Premium",
        description: "Likes ilimitados, ve quién te dio like, impulsa tu perfil y conecta con miembros exclusivos",
        unlimitedLikes: "Likes y super likes ilimitados",
        seeWhoLiked: "Ve quién ya te dio like",
        freeBoost: "1 boost gratis por semana",
        priorityFeed: "Prioridad en el feed",
        upgrade: "Upgrade — 9.99 USDC/mes",
        maybeLater: "Quizás después",
        orWLD: "o paga con WLD",
      },
      matches: {
        title: "Matches",
        subtitle: "Tus conexiones",
        noMatches: "Aún no tienes matches",
        noMatchesSub: "Empieza a deslizar para encontrar tu match",
        newMatch: "Nuevo",
        orbVerified: "Verificado Orb",
      },
      events: {
        title: "Eventos",
        subtitle: "Conoce humanos verificados en persona",
        noEvents: "No hay eventos próximos",
        noEventsSub: "Vuelve pronto para nuevos eventos",
        attending: "asistiendo",
        youHaveTicket: "Tienes un ticket",
        soldOut: "Agotado",
      },
      profile: {
        editProfile: "Editar perfil",
        save: "Guardar",
        saving: "Guardando...",
        orbVerified: "Verificado Orb",
        matches: "Matches",
        superLikes: "Super Likes",
        matchRate: "Tasa de match",
        name: "Nombre",
        bio: "Bio",
        photos: "Fotos",
        premium: "Premium",
        getPremium: "Obtener Premium",
        premiumMember: "Miembro Premium",
        boost: "Impulsar perfil",
        boostDesc: "Sé visto por 10x más personas por 30 minutos",
        logout: "Cerrar sesión",
        referral: "Invitar amigos",
      },
      chat: {
        startConvo: "¡Inicia la conversación!",
        saySomething: "Dile algo lindo a {name}",
        typeMessage: "Escribe un mensaje...",
        send: "Enviar",
      },
      nav: {
        discover: "Descubrir",
        matches: "Matches",
        events: "Eventos",
        profile: "Perfil",
      },
      common: {
        loading: "Cargando...",
        error: "Error",
        retry: "Reintentar",
        cancel: "Cancelar",
        confirm: "Confirmar",
        close: "Cerrar",
      },
    },
  };

  type Translations = typeof translations.en;
  type NestedKeys<T, P extends string = ""> = T extends object
    ? { [K in keyof T]: NestedKeys<T[K], P extends "" ? `${K & string}` : `${P}.${K & string}`> }[keyof T]
    : P;

  interface I18nContextType {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
  }

  const I18nContext = createContext<I18nContextType>({
    lang: "en",
    setLang: () => {},
    t: (key) => key,
  });

  export function I18nProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(() => {
      const stored = localStorage.getItem("hlove_lang");
      return (stored === "es" || stored === "en") ? stored : "en";
    });

    const setLang = useCallback((newLang: Lang) => {
      setLangState(newLang);
      localStorage.setItem("hlove_lang", newLang);
    }, []);

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".");
      let value: any = translations[lang];
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          let fallback: any = translations.en;
          for (const fk of keys) fallback = fallback?.[fk];
          value = fallback || key;
          break;
        }
      }
      if (typeof value !== "string") return key;
      if (params) {
        return Object.entries(params).reduce((str, [k, v]) => str.replace("{" + k + "}", String(v)), value);
      }
      return value;
    }, [lang]);

    return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
  }

  export function useI18n() {
    return useContext(I18nContext);
  }

  export function LanguageSelector() {
    const { lang, setLang } = useI18n();
    return (
      <button
        onClick={() => setLang(lang === "en" ? "es" : "en")}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/30 text-xs font-medium hover:bg-muted transition-colors"
      >
        <span className="text-sm">{lang === "en" ? "🇺🇸" : "🇪🇸"}</span>
        <span className="uppercase">{lang}</span>
      </button>
    );
  }
  