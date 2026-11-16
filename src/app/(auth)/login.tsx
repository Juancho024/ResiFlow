import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Modal,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../hooks/useAppTheme';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

// Oculta el icono de ojo nativo de Microsoft Edge / Chrome en todos los campos de contraseña en Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const styleId = 'resiflow-hide-ms-reveal';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            input::-ms-reveal,
            input::-ms-clear {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================================================
// 1. GESTOR DE SESIÓN GLOBAL POR ROLES (Compatible con Web PC y Móvil)
// ============================================================================
export type UserRole = 'ADMIN' | 'PROPIETARIO' | 'EMPRESA' | null;

export interface UserSession {
    id: number;
    idResidencial: number;
    email: string;
    nombre: string;
    rol: UserRole;
    unidad?: string;
    torre?: string;
}

let currentSession: UserSession | null = null;

export const SessionStore = {
    getSession: (): UserSession | null => {
        if (currentSession) return currentSession;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const saved = window.localStorage.getItem('resiflow_session');
            if (saved) {
                try {
                    currentSession = JSON.parse(saved);
                    return currentSession;
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    },
    setSession: async (session: UserSession | null, recordar: boolean = true) => {
        currentSession = session;
        try {
            if (session && recordar) {
                const raw = JSON.stringify(session);
                await AsyncStorage.setItem('resiflow_session', raw);
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.localStorage.setItem('resiflow_session', raw);
                }
            } else {
                await AsyncStorage.removeItem('resiflow_session');
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.localStorage.removeItem('resiflow_session');
                }
            }
        } catch (e) {
            console.log('Error guardando sesión:', e);
        }
    },
    restoreSession: async (): Promise<UserSession | null> => {
        try {
            const saved = await AsyncStorage.getItem('resiflow_session');
            if (saved) {
                currentSession = JSON.parse(saved);
                return currentSession;
            }
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const webSaved = window.localStorage.getItem('resiflow_session');
                if (webSaved) {
                    currentSession = JSON.parse(webSaved);
                    return currentSession;
                }
            }
        } catch (e) {
            console.log('Error restaurando sesión:', e);
        }
        return currentSession;
    },
    logout: async () => {
        await SessionStore.setSession(null, false);
    },
};

// ============================================================================
// GESTOR DE PREFERENCIAS GLOBALES (Modo Oscuro, Notificaciones e IA)
// ============================================================================
export interface AppPreferences {
    darkMode: boolean;
    notifications: boolean;
    iaActiva: boolean;
}

let currentPrefs: AppPreferences = {
    darkMode: false,
    notifications: true,
    iaActiva: true,
};

let prefListeners: Array<(prefs: AppPreferences) => void> = [];

export const PreferencesStore = {
    get: (): AppPreferences => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const saved = window.localStorage.getItem('resiflow_preferences');
            if (saved) {
                try {
                    currentPrefs = { ...currentPrefs, ...JSON.parse(saved) };
                } catch (e) {}
            }
        }
        return currentPrefs;
    },
    set: (partial: Partial<AppPreferences>) => {
        currentPrefs = { ...PreferencesStore.get(), ...partial };
        const raw = JSON.stringify(currentPrefs);

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.localStorage.setItem('resiflow_preferences', raw);
        }
        void AsyncStorage.setItem('resiflow_preferences', raw).catch(() => {});

        prefListeners.forEach((listener) => listener(currentPrefs));
    },
    restore: async (): Promise<AppPreferences> => {
        try {
            const saved = await AsyncStorage.getItem('resiflow_preferences');
            if (saved) {
                currentPrefs = { ...currentPrefs, ...JSON.parse(saved) };
                prefListeners.forEach((listener) => listener(currentPrefs));
                return currentPrefs;
            }
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const webSaved = window.localStorage.getItem('resiflow_preferences');
                if (webSaved) {
                    currentPrefs = { ...currentPrefs, ...JSON.parse(webSaved) };
                    prefListeners.forEach((listener) => listener(currentPrefs));
                }
            }
        } catch (e) {
            console.log('Error restaurando preferencias:', e);
        }
        return currentPrefs;
    },
    subscribe: (listener: (prefs: AppPreferences) => void) => {
        prefListeners.push(listener);
        return () => {
            prefListeners = prefListeners.filter((l) => l !== listener);
        };
    },
};

void PreferencesStore.restore();

// ============================================================================
// 2. SISTEMA DE ALERTAS, CONFIRMACIONES Y TOASTS PROFESIONALES (ResiAlert)
// ============================================================================
export type AlertType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'CONFIRM' | 'DANGER_CONFIRM';

interface AlertState {
    visible: boolean;
    tipo: AlertType;
    titulo: string;
    mensaje: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    onConfirm?: () => void;
}

interface ToastState {
    visible: boolean;
    tipo: 'SUCCESS' | 'ERROR' | 'INFO';
    texto: string;
}

let alertListeners: Array<(state: AlertState) => void> = [];
let toastListeners: Array<(state: ToastState) => void> = [];
let toastTimer: any = null;

const emitAlert = (state: AlertState) => {
    alertListeners.forEach((l) => l(state));
};

const emitToast = (state: ToastState) => {
    toastListeners.forEach((l) => l(state));
};

const inferirTipoYTitulo = (mensaje: string): { tipo: AlertType; titulo: string } => {
    const m = mensaje.toLowerCase();
    if (
        m.includes('error') ||
        m.includes('no se pudo') ||
        m.includes('incorrecto') ||
        m.includes('problema') ||
        m.includes('rechazado')
    ) {
        return { tipo: 'ERROR', titulo: 'Atención Requerida' };
    }
    if (
        m.includes('faltan') ||
        m.includes('incompleta') ||
        m.includes('por favor') ||
        m.includes('obligatorio') ||
        m.includes('debes') ||
        m.includes('seleccione') ||
        m.includes('válido')
    ) {
        return { tipo: 'WARNING', titulo: 'Datos Incompletos' };
    }
    if (
        m.includes('éxito') ||
        m.includes('exitosamente') ||
        m.includes('enviado') ||
        m.includes('registrado') ||
        m.includes('actualizado') ||
        m.includes('aprobado') ||
        m.includes('aplicado') ||
        m.includes('✓')
    ) {
        return { tipo: 'SUCCESS', titulo: 'Operación Exitosa' };
    }
    return { tipo: 'INFO', titulo: 'Aviso de ResiFlow' };
};

export const ResiAlert = {
    show: (opciones: {
        tipo?: AlertType;
        titulo?: string;
        mensaje: string;
        textoConfirmar?: string;
        onConfirm?: () => void;
    }) => {
        const inferido = inferirTipoYTitulo(opciones.mensaje);
        emitAlert({
            visible: true,
            tipo: opciones.tipo || inferido.tipo,
            titulo: opciones.titulo || inferido.titulo,
            mensaje: opciones.mensaje,
            textoConfirmar: opciones.textoConfirmar || 'Entendido',
            onConfirm: opciones.onConfirm,
        });
    },
    success: (titulo: string, mensaje: string, onConfirm?: () => void) =>
        ResiAlert.show({ tipo: 'SUCCESS', titulo, mensaje, textoConfirmar: 'Perfecto', onConfirm }),
    error: (titulo: string, mensaje: string) =>
        ResiAlert.show({ tipo: 'ERROR', titulo, mensaje, textoConfirmar: 'Revisar' }),
    warning: (titulo: string, mensaje: string) =>
        ResiAlert.show({ tipo: 'WARNING', titulo, mensaje, textoConfirmar: 'Completar Datos' }),
    info: (titulo: string, mensaje: string) =>
        ResiAlert.show({ tipo: 'INFO', titulo, mensaje, textoConfirmar: 'Entendido' }),
    confirm: (
        opcionesOrTitulo:
            | {
            titulo: string;
            mensaje: string;
            textoConfirmar?: string;
            textoCancelar?: string;
            peligro?: boolean;
            onConfirm: () => void;
        }
            | string,
        mensaje?: string,
        onConfirm?: () => void,
        textoConfirmar = 'Sí, Confirmar',
        textoCancelar = 'Cancelar'
    ) => {
        if (typeof opcionesOrTitulo === 'object') {
            emitAlert({
                visible: true,
                tipo: opcionesOrTitulo.peligro ? 'DANGER_CONFIRM' : 'CONFIRM',
                titulo: opcionesOrTitulo.titulo,
                mensaje: opcionesOrTitulo.mensaje,
                textoConfirmar: opcionesOrTitulo.textoConfirmar || 'Sí, Confirmar',
                textoCancelar: opcionesOrTitulo.textoCancelar || 'Cancelar',
                onConfirm: opcionesOrTitulo.onConfirm,
            });
        } else {
            emitAlert({
                visible: true,
                tipo: 'CONFIRM',
                titulo: opcionesOrTitulo,
                mensaje: mensaje || '',
                textoConfirmar,
                textoCancelar,
                onConfirm,
            });
        }
    },
    toast: (texto: string, tipo: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
        if (toastTimer) clearTimeout(toastTimer);
        emitToast({ visible: true, tipo, texto });
        toastTimer = setTimeout(() => {
            emitToast({ visible: false, tipo, texto: '' });
        }, 3200);
    },
};

export function ResiAlertOverlay() {
    const { colors, darkMode } = useAppTheme();

    const [state, setState] = useState<AlertState>({
        visible: false,
        tipo: 'INFO',
        titulo: '',
        mensaje: '',
    });

    const [toast, setToast] = useState<ToastState>({
        visible: false,
        tipo: 'SUCCESS',
        texto: '',
    });

    useEffect(() => {
        const subAlert = (newState: AlertState) => setState(newState);
        const subToast = (newToast: ToastState) => setToast(newToast);
        alertListeners.push(subAlert);
        toastListeners.push(subToast);

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert = (msg?: any) => {
                ResiAlert.show({ mensaje: String(msg ?? '') });
            };
        }

        return () => {
            alertListeners = alertListeners.filter((l) => l !== subAlert);
            toastListeners = toastListeners.filter((l) => l !== subToast);
        };
    }, []);

    const configPorTipo: Record<
        AlertType,
        { icon: string; color: string; bgIcon: string; badge: string }
    > = {
        SUCCESS: {
            icon: 'check-circle',
            color: colors.success,
            bgIcon: colors.successBg,
            badge: 'OPERACIÓN COMPLETADA',
        },
        ERROR: {
            icon: 'x-circle',
            color: colors.danger,
            bgIcon: colors.dangerBg,
            badge: 'ALERTA DE SISTEMA',
        },
        WARNING: {
            icon: 'alert-triangle',
            color: colors.warning,
            bgIcon: colors.warningBg,
            badge: 'ATENCIÓN REQUERIDA',
        },
        INFO: {
            icon: 'info',
            color: colors.primary,
            bgIcon: colors.primarySoft,
            badge: 'AVISO RESIFLOW',
        },
        CONFIRM: {
            icon: 'help-circle',
            color: colors.primary,
            bgIcon: colors.primarySoft,
            badge: 'CONFIRMACIÓN REQUERIDA',
        },
        DANGER_CONFIRM: {
            icon: 'trash-2',
            color: colors.danger,
            bgIcon: colors.dangerBg,
            badge: 'ACCIÓN PERMANENTE',
        },
    };

    const tema = configPorTipo[state.tipo];
    const cerrar = () => setState((prev) => ({ ...prev, visible: false }));
    const esConfirmacion = state.tipo === 'CONFIRM' || state.tipo === 'DANGER_CONFIRM';

    return (
        <>
            {toast.visible ? (
                <Modal visible={true} transparent animationType="fade">
                    <View pointerEvents="box-none" style={alertStyles.toastPortalContainer}>
                        <View
                            style={[
                                alertStyles.toastBox,
                                toast.tipo === 'ERROR'
                                    ? { backgroundColor: '#991B1B', borderColor: '#FCA5A5' }
                                    : toast.tipo === 'INFO'
                                        ? { backgroundColor: '#1E1B4B', borderColor: '#6366F1' }
                                        : { backgroundColor: '#065F46', borderColor: '#6EE7B7' },
                            ]}
                        >
                            <Feather
                                name={
                                    toast.tipo === 'ERROR'
                                        ? 'alert-circle'
                                        : toast.tipo === 'INFO'
                                            ? 'info'
                                            : 'check-circle'
                                }
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={alertStyles.toastText}>{toast.texto}</Text>
                        </View>
                    </View>
                </Modal>
            ) : null}

            {state.visible ? (
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={cerrar}
                >
                    <View
                        style={[
                            alertStyles.backdrop,
                            { backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.78)' : 'rgba(15, 23, 42, 0.72)' },
                        ]}
                    >
                        <View
                            style={[
                                alertStyles.card,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    borderTopColor: tema.color,
                                },
                            ]}
                        >
                            <View style={alertStyles.topRow}>
                                <View style={[alertStyles.iconCircle, { backgroundColor: tema.bgIcon }]}>
                                    <Feather name={tema.icon as any} size={24} color={tema.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[alertStyles.badgeText, { color: tema.color }]}>
                                        ● {tema.badge}
                                    </Text>
                                    <Text style={[alertStyles.title, { color: colors.text }]}>
                                        {state.titulo}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[alertStyles.closeCorner, { backgroundColor: colors.inputBg }]}
                                    onPress={cerrar}
                                >
                                    <Feather name="x" size={18} color={colors.subText} />
                                </TouchableOpacity>
                            </View>

                            <View
                                style={[
                                    alertStyles.messageBox,
                                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                                ]}
                            >
                                <Text style={[alertStyles.message, { color: colors.text }]}>
                                    {state.mensaje}
                                </Text>
                            </View>

                            <View style={alertStyles.footer}>
                                {esConfirmacion && (
                                    <TouchableOpacity
                                        style={[alertStyles.cancelBtn, { backgroundColor: colors.inputBg }]}
                                        onPress={cerrar}
                                    >
                                        <Text style={[alertStyles.cancelBtnText, { color: colors.subText }]}>
                                            {state.textoCancelar || 'Cancelar'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[
                                        alertStyles.confirmBtn,
                                        {
                                            backgroundColor:
                                                state.tipo === 'ERROR' || state.tipo === 'DANGER_CONFIRM'
                                                    ? colors.danger
                                                    : state.tipo === 'SUCCESS'
                                                        ? colors.success
                                                        : state.tipo === 'WARNING'
                                                            ? colors.warning
                                                            : colors.primary,
                                        },
                                    ]}
                                    onPress={() => {
                                        cerrar();
                                        if (state.onConfirm) state.onConfirm();
                                    }}
                                >
                                    <Text style={alertStyles.confirmBtnText}>
                                        {state.textoConfirmar || 'Entendido'}
                                    </Text>
                                    <Feather
                                        name={
                                            state.tipo === 'DANGER_CONFIRM'
                                                ? 'trash-2'
                                                : 'arrow-right'
                                        }
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </>
    );
}

// ============================================================================
// 3. RE-EXPORTACIÓN DEL ASISTENTE IA SEPARADO
// ============================================================================
export { ResiAssistantWidget } from '../components/ResiAssistantWidget';

// ============================================================================
// 4. PANTALLA DE LOGIN
// ============================================================================
export default function LoginScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;
    const { colors } = useAppTheme();

    const [isRestoring, setIsRestoring] = useState(true);
    const [usuarioInput, setUsuarioInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [recordarSesion, setRecordarSesion] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const inicializar = async () => {
            await PreferencesStore.restore();

            const savedSession = await SessionStore.restoreSession();
            if (savedSession && isMounted) {
                if (savedSession.rol === 'ADMIN') {
                    router.replace('/(admin)/dashboard');
                    return;
                } else if (savedSession.rol === 'EMPRESA') {
                    if (Platform.OS === 'web') {
                        router.replace('/(empresa)/dashboard');
                        return;
                    } else {
                        await SessionStore.logout();
                    }
                } else {
                    router.replace('/(propietario)');
                    return;
                }
            }

            if (isMounted) setIsRestoring(false);
        };

        void inicializar();

        return () => {
            isMounted = false;
        };
    }, []);

    const alIniciarSesion = async (idUsuario: number, esAdmin: boolean, idResidencial: number) => {
        if (Platform.OS === 'web') return;

        try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') return;

            const { data: deviceToken } = await Notifications.getDevicePushTokenAsync();
            const topicAsignado = esAdmin ? `admin_residencial_${idResidencial}` : `usuario_${idUsuario}`;

            await fetch(`${API_BASE}/notificaciones/suscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: deviceToken,
                    topic: topicAsignado,
                }),
            });
        } catch (error) {
            console.log('Error suscribiendo al topic de notificaciones:', error);
        }
    };

    const handleLogin = async () => {
        setErrorMsg('');
        const nombreUsuarioStr = usuarioInput.trim();
        const passwordStr = password;

        if (!nombreUsuarioStr || !passwordStr) {
            setErrorMsg('Por favor ingresa tu usuario y contraseña.');
            ResiAlert.warning(
                'Credenciales Requeridas',
                'Por favor ingresa tu nombre de usuario y tu contraseña para acceder a ResiFlow.'
            );
            return;
        }

        setIsLoadingAuth(true);

        try {
            const response = await fetch(`${API_BASE}/usuarios/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: nombreUsuarioStr,
                    password: passwordStr,
                }),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = responseText;
            }

            if (response.ok && data.exito !== false && data.usuario) {
                const userDB = data.usuario;
                const rolDB = String(userDB.rol || '').toUpperCase();

                if ((rolDB === 'EMPRESA' || rolDB === 'EMPLEADO') && Platform.OS !== 'web') {
                    ResiAlert.warning(
                        'Acceso Restringido',
                        'El panel administrativo de la Empresa solo está disponible desde una computadora (Web).'
                    );
                    setIsLoadingAuth(false);
                    return;
                }

                const esAdmin = rolDB === 'ADMIN';
                const idResidencialActual = Number(userDB.idResidencial ?? userDB.id_residencial) || 1;

                // Consultamos en la BD el nombre real del residencial asignado a este usuario
                let nombreResidencialBD = 'Residencial';
                try {
                    const resCondo = await fetch(
                        `${API_BASE}/residencial?idResidencial=${idResidencialActual}`
                    );
                    if (resCondo.ok) {
                        const condoData = await resCondo.json();
                        if (condoData?.nombre) {
                            nombreResidencialBD = condoData.nombre;
                        }
                    }
                } catch (e) {
                    console.log('Error obteniendo info del residencial:', e);
                }

                await SessionStore.setSession(
                    {
                        id: userDB.id,
                        idResidencial: idResidencialActual,
                        email: userDB.username || userDB.usuario,
                        nombre: userDB.nombre,
                        rol: esAdmin ? 'ADMIN' : rolDB === 'EMPRESA' ? 'EMPRESA' : 'PROPIETARIO',
                        unidad: userDB.numApto ? `Apto. ${userDB.numApto}` : undefined,
                        torre: nombreResidencialBD,
                    },
                    recordarSesion
                );

                ResiAlert.toast(`¡Bienvenido, ${userDB.nombre}! (${nombreResidencialBD})`, 'SUCCESS');

                await alIniciarSesion(userDB.id, esAdmin, idResidencialActual);

                if (esAdmin) {
                    router.replace('/(admin)/dashboard');
                } else if (rolDB === 'EMPRESA') {
                    router.replace('/(empresa)/dashboard');
                } else {
                    router.replace('/(propietario)');
                }
            } else {
                const msg =
                    data.mensaje ||
                    (typeof data === 'string' ? data : 'Usuario o contraseña incorrectos.');
                setErrorMsg(msg);
                ResiAlert.error('Acceso Denegado', msg);
            }
        } catch (error) {
            console.error('Error de red:', error);
            const msg = 'No se pudo conectar con el servidor de Azure. Verifica tu conexión.';
            setErrorMsg(msg);
            ResiAlert.error('Sin Conexión al Servidor', msg);
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const handleLoginEmpresa = async () => {
        if (Platform.OS !== 'web') {
            ResiAlert.warning(
                'Acceso Restringido',
                'El panel Master de Empresa solo está habilitado en versión Web.'
            );
            return;
        }
        await SessionStore.setSession(
            {
                id: 999,
                idResidencial: 1,
                email: 'master_admin',
                nombre: 'Juan Rijo (Master)',
                rol: 'EMPRESA',
            },
            recordarSesion
        );
        ResiAlert.toast('Entrando al Panel Master ResiFlow', 'INFO');
        router.replace('/(empresa)/dashboard');
    };

    if (isRestoring) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: colors.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.bg }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop]}>
                {isDesktop && (
                    <View style={styles.brandPanel}>
                        <View style={styles.brandHeader}>
                            <View>
                                <Image
                                    source={require('../../assets/images/systemmanager_sinfondo.png')}
                                    style={{ width: 70, height: 70, resizeMode: 'contain' }}
                                />
                            </View>
                            <Text style={styles.brandName}>ResiFlow</Text>
                        </View>

                        <View style={styles.brandHero}>
                            <View style={styles.badgePill}>
                                <Text style={styles.badgePillText}>
                                    ● SISTEMA DE GESTIÓN RESIDENCIAL V4.6.0
                                </Text>
                            </View>
                            <Text style={styles.heroTitle}>
                                Control total de mantenimiento, gas común y finanzas en tiempo real.
                            </Text>
                            <Text style={styles.heroSubtitle}>
                                Plataforma unificada con acceso seguro por roles para la Administración y el Portal de Propietarios.
                            </Text>

                            <View style={styles.featureList}>
                                <View style={styles.featureItem}>
                                    <Feather name="check-circle" size={20} color="#4ADE80" />
                                    <Text style={styles.featureText}>
                                        Facturación masiva de mantenimiento y lectura de gas (m³)
                                    </Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Feather name="check-circle" size={20} color="#4ADE80" />
                                    <Text style={styles.featureText}>
                                        Conciliación de transferencias, efectivo y caja chica
                                    </Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Feather name="check-circle" size={20} color="#4ADE80" />
                                    <Text style={styles.featureText}>
                                        Estados de cuenta históricos y recibos certificados en PDF
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.brandFooter}>JR Technology S.R.L</Text>
                    </View>
                )}

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={styles.formContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View
                            style={[
                                styles.formCard,
                                { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                        >
                            {!isDesktop && (
                                <View style={styles.mobileLogoRow}>
                                    <View>
                                        <Image
                                            source={require('../../assets/images/systemmanager_sinfondo.png')}
                                            style={{ width: 35, height: 35, resizeMode: 'contain' }}
                                        />
                                    </View>
                                    <Text style={[styles.mobileBrandName, { color: colors.text }]}>
                                        ResiFlow
                                    </Text>
                                </View>
                            )}

                            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                                Iniciar Sesión
                            </Text>
                            <Text style={[styles.welcomeSubtitle, { color: colors.subText }]}>
                                Ingresa tus credenciales para acceder al panel de administración o al portal de propietarios.
                            </Text>

                            {errorMsg ? (
                                <View
                                    style={[
                                        styles.errorBanner,
                                        { backgroundColor: colors.dangerBg, borderColor: colors.danger },
                                    ]}
                                >
                                    <Feather name="alert-circle" size={18} color={colors.danger} />
                                    <Text style={[styles.errorText, { color: colors.danger }]}>
                                        {errorMsg}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Usuario</Text>
                                <View
                                    style={[
                                        styles.inputWrapper,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    ]}
                                >
                                    <Feather
                                        name="user"
                                        size={18}
                                        color={colors.subText}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="Ej: Juancho"
                                        placeholderTextColor={colors.subText}
                                        autoCapitalize="none"
                                        value={usuarioInput}
                                        onChangeText={setUsuarioInput}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Contraseña</Text>
                                <View
                                    style={[
                                        styles.inputWrapper,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    ]}
                                >
                                    <Feather
                                        name="lock"
                                        size={18}
                                        color={colors.subText}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.subText}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Feather
                                            name={showPassword ? 'eye-off' : 'eye'}
                                            size={18}
                                            color={colors.subText}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.rememberRow}
                                onPress={() => setRecordarSesion(!recordarSesion)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.checkboxBox,
                                        {
                                            borderColor: recordarSesion ? colors.primary : colors.border,
                                            backgroundColor: recordarSesion ? colors.primary : 'transparent',
                                        },
                                    ]}
                                >
                                    {recordarSesion && (
                                        <Feather name="check" size={14} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={[styles.rememberText, { color: colors.text }]}>
                                    Mantener sesión iniciada
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.primaryBtn,
                                    { backgroundColor: colors.primary },
                                    isLoadingAuth && { opacity: 0.7 },
                                ]}
                                onPress={handleLogin}
                                disabled={isLoadingAuth}
                            >
                                <Text style={styles.primaryBtnText}>
                                    {isLoadingAuth ? 'Conectando...' : 'Ingresar al Sistema'}
                                </Text>
                                {!isLoadingAuth && (
                                    <Feather name="arrow-right" size={18} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>

                            {isDesktop && (
                                <TouchableOpacity
                                    style={[
                                        styles.devBtn,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    ]}
                                    onPress={handleLoginEmpresa}
                                >
                                    <Feather name="shield" size={16} color={colors.text} />
                                    <Text style={[styles.devBtnText, { color: colors.text }]}>
                                        Acceso Rápido Modo Empresa (Dev)
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
            <ResiAlertOverlay />
        </KeyboardAvoidingView>
    );
}

const alertStyles = StyleSheet.create({
    toastPortalContainer: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingTop: 22,
        paddingRight: 24,
    },
    toastBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 15,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 430,
        borderRadius: 22,
        padding: 24,
        borderTopWidth: 5,
        borderWidth: 1,
        shadowColor: '#0F172A',
        shadowOpacity: 0.3,
        shadowRadius: 28,
        elevation: 20,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 16,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    closeCorner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageBox: {
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    message: {
        fontSize: 14,
        lineHeight: 21,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    confirmBtn: {
        flex: 1.4,
        paddingVertical: 13,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    mainWrapper: { flex: 1 },
    mainWrapperDesktop: { flexDirection: 'row' },
    brandPanel: {
        flex: 1.1,
        backgroundColor: '#1E1B4B',
        padding: 48,
        justifyContent: 'space-between',
    },
    brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandName: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
    brandHero: { maxWidth: 480 },
    badgePill: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(59, 56, 246, 0.35)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    badgePillText: { color: '#A5B4FC', fontSize: 11, fontWeight: '700' },
    heroTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', lineHeight: 42, marginBottom: 16 },
    heroSubtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 24, marginBottom: 32 },
    featureList: { gap: 14 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureText: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
    brandFooter: { color: '#64748B', fontSize: 13 },
    formContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    formCard: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 20,
        padding: 32,
        borderWidth: 1,
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 3,
    },
    mobileLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
    mobileBrandName: { fontSize: 22, fontWeight: '800' },
    welcomeTitle: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
    welcomeSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    errorText: { fontSize: 13, fontWeight: '600', flex: 1 },
    inputGroup: { marginBottom: 18 },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, height: '100%', outlineStyle: 'none' } as any,
    rememberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rememberText: {
        fontSize: 14,
        fontWeight: '600',
    },
    primaryBtn: {
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    devBtn: {
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 14,
        borderWidth: 1,
    },
    devBtnText: { fontSize: 14, fontWeight: '700' },
});