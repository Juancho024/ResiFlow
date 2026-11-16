import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
    Modal,
    ScrollView,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    SessionStore,
    UserSession,
    ResiAlert,
    ResiAlertOverlay,
    ResiAssistantWidget,
} from '../(auth)/login';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

Notifications.setNotificationHandler({
    handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export default function PropietarioLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktop = width >= 900;

    const { colors } = useAppTheme();

    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const [nombreResidencial, setNombreResidencial] = useState('Residencial Santos I');
    const [torreReal, setTorreReal] = useState('Torre A');
    const [aptoReal, setAptoReal] = useState('A-1');

    const [notificaciones, setNotificaciones] = useState<any[]>([]);
    const [notifOpen, setNotifOpen] = useState(false);

    useEffect(() => {
        const current = SessionStore.getSession();
        if (!current) {
            router.replace('/(auth)/login');
            return;
        }
        if (current.rol === 'ADMIN') {
            router.replace('/(admin)/dashboard');
            return;
        }
        if (current.rol === 'EMPRESA') {
            router.replace('/(empresa)/dashboard');
            return;
        }
        setSession(current);
        const aptoLimpio = current.unidad?.replace('Apto. ', '').trim() || 'A-1';
        setAptoReal(aptoLimpio);
        setTorreReal(aptoLimpio.toUpperCase().startsWith('B') ? 'Torre B' : 'Torre A');

        void cargarDatosContexto(current, aptoLimpio);
        void cargarNotificaciones(current.id);
        void registrarPushNotifications(current.id);

        const subscription = Notifications.addNotificationReceivedListener((notification) => {
            void cargarNotificaciones(current.id);
            ResiAlert.toast('🔔 ' + notification.request.content.title, 'INFO');
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
            const ruta = response.notification.request.content.data?.ruta;
            if (ruta) router.push(ruta as any);
        });

        return () => {
            subscription.remove();
            responseSubscription.remove();
        };
    }, [pathname]);

    const registrarPushNotifications = async (idUsuario: number) => {
        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Permiso denegado para notificaciones push');
                return;
            }

            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId: 'b05bb0a8-2ac2-4c73-a07e-b929289fee5b',
                });
                const token = tokenData.data;

                console.log('Token de Expo generado para este celular:', token);

                await fetch(`${API_BASE}/usuarios/${idUsuario}/token-push`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pushToken: token }),
                });
            } catch (error) {
                console.error('Error al registrar el token de notificaciones:', error);
            }
        } else {
            console.log('Las notificaciones Push reales solo funcionan en un celular físico, no en emuladores web.');
        }
    };

    const cargarDatosContexto = async (user: UserSession, aptoStr: string) => {
        try {
            const [resCondo, resProps] = await Promise.all([
                fetch(`${API_BASE}/residencial?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`).catch(() => null),
            ]);

            if (resCondo?.ok) {
                const data = await resCondo.json();
                const obj = Array.isArray(data) ? data[0] : data;
                if (obj?.nombre) setNombreResidencial(obj.nombre);
            }

            if (resProps?.ok) {
                const lista = await resProps.json();
                const miProp = lista.find(
                    (p: any) =>
                        (user.id && p.idUsuario === user.id) ||
                        String(p.apto || p.numApto || '').trim().toUpperCase() === aptoStr.toUpperCase() ||
                        String(p.nombre || p.nombrePropietario || '').trim().toLowerCase() ===
                        user.nombre.trim().toLowerCase()
                );
                if (miProp) {
                    const aptoBD = miProp.apto || miProp.numApto || aptoStr;
                    setAptoReal(aptoBD);
                    setTorreReal(miProp.torre || (aptoBD.toUpperCase().startsWith('B') ? 'Torre B' : 'Torre A'));
                }
            }
        } catch (error) {
            console.warn('Modo local activo en layout propietario');
        }
    };

    const cargarNotificaciones = async (idUsuario: number) => {
        try {
            const [resPersonales, resGenerales, vistasRaw] = await Promise.all([
                fetch(`${API_BASE}/notificaciones/usuario/${idUsuario}?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/notificaciones/admin?idResidencial=${idResidencial}`).catch(() => null),
                AsyncStorage.getItem(`resiflow_notifs_ocultas_${idUsuario}`).catch(() => null),
            ]);

            const idsOcultos: number[] = vistasRaw ? JSON.parse(vistasRaw) : [];

            const personales = resPersonales?.ok ? await resPersonales.json() : [];
            const generalesRaw = resGenerales?.ok ? await resGenerales.json() : [];

            // Filtramos las generales para traer solo avisos/cobros del Admin
            // (ignorando notificaciones internas del admin como 'PAGO' por validar de otros vecinos)
            const generalesDelAdmin = generalesRaw.filter(
                (n: any) =>
                    n.tipo !== 'SISTEMA' &&
                    !idsOcultos.includes(n.id)
            );

            // Unimos ambas listas y las ordenamos de la más reciente a la más antigua
            const todas = [...personales, ...generalesDelAdmin].sort((a, b) => b.id - a.id);
            setNotificaciones(todas);
        } catch (error) {
            console.log('Error cargando notificaciones de la BD');
        }
    };

    const eliminarNotificacion = async (idNotificacion: number, ruta: string) => {
        try {
            await fetch(`${API_BASE}/notificaciones/${idNotificacion}`, { method: 'DELETE' });
            setNotifOpen(false);
            setNotificaciones((prev) => prev.filter((n) => n.id !== idNotificacion));
            if (ruta) router.push(ruta as any);
        } catch (error) {
            console.log('Error eliminando notificación');
        }
    };

    const navItems = [
        {
            label: 'Inicio',
            icon: 'home',
            path: '/(propietario)',
            exact: true,
        },
        {
            label: isDesktop ? 'Mis Pagos y Estado' : 'Pagos',
            icon: 'file-text',
            path: '/(propietario)/mis-pagos',
            match: 'mis-pagos',
        },
        {
            label: isDesktop ? 'Avisos y Averías' : 'Avisos',
            icon: 'message-square',
            path: '/(propietario)/avisos-reportes',
            match: 'avisos-reportes',
        },
        {
            label: 'Reservas',
            icon: 'calendar',
            path: '/(propietario)/reservas',
            match: 'reservas',
        },
        {
            label: 'Ajustes',
            icon: 'settings',
            path: '/(propietario)/settings',
            match: 'settings',
        },
    ];

    const handleLogout = () => {
        ResiAlert.confirm({
            titulo: 'Cerrar Sesión',
            mensaje: '¿Deseas cerrar tu sesión en el Portal de Propietario de ResiFlow?',
            textoConfirmar: 'Sí, Salir',
            peligro: true,
            onConfirm: () => {
                void SessionStore.logout();
                router.replace('/(auth)/login');
            },
        });
    };

    if (!session) return null;

    return (
        <View style={[styles.root, { backgroundColor: colors.bg }]}>
            {isDesktop && (
                <View
                    style={[
                        styles.sidebar,
                        { backgroundColor: colors.card, borderRightColor: colors.border },
                    ]}
                >
                    <View>
                        <View style={styles.brandBox}>
                            <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
                                <MaterialCommunityIcons name="home-city-outline" size={24} color="#FFFFFF" />
                            </View>
                            <View>
                                <Text style={[styles.brandTitle, { color: colors.text }]}>ResiFlow</Text>
                                <Text style={[styles.brandSub, { color: colors.subText }]}>
                                    Portal de Propietario
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.unitBanner, { backgroundColor: colors.primarySoft }]}>
                            <Text style={[styles.unitBannerName, { color: colors.text }]}>
                                {session.nombre}
                            </Text>
                            <Text style={[styles.unitBannerApt, { color: colors.primary }]}>
                                Apto. {aptoReal} • {torreReal}
                            </Text>
                            <Text style={[styles.unitBannerCondo, { color: colors.subText }]}>
                                {nombreResidencial}
                            </Text>
                        </View>

                        <View style={{ gap: 6 }}>
                            {navItems.map((item) => {
                                const isActive = item.exact
                                    ? pathname === '/' || pathname === '/(propietario)' || pathname === '/(propietario)/'
                                    : pathname.includes(item.match!);
                                return (
                                    <TouchableOpacity
                                        key={item.label}
                                        style={[
                                            styles.menuItem,
                                            isActive && { backgroundColor: colors.primary },
                                        ]}
                                        onPress={() => router.push(item.path as any)}
                                    >
                                        <Feather
                                            name={item.icon as any}
                                            size={18}
                                            color={isActive ? '#FFFFFF' : colors.subText}
                                        />
                                        <Text
                                            style={[
                                                styles.menuText,
                                                { color: isActive ? '#FFFFFF' : colors.subText },
                                                isActive && { fontWeight: '700' },
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.logoutBtn, { backgroundColor: colors.dangerBg }]}
                        onPress={handleLogout}
                    >
                        <Feather name="log-out" size={16} color={colors.danger} />
                        <Text style={[styles.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <View
                    style={[
                        styles.topbar,
                        {
                            backgroundColor: colors.card,
                            borderBottomColor: colors.border,
                            paddingTop: isDesktop ? 0 : insets.top,
                            height: isDesktop ? 66 : 66 + insets.top,
                        },
                    ]}
                >
                    <View>
                        <Text style={[styles.topbarName, { color: colors.text }]}>
                            {session.nombre}
                        </Text>
                        <Text style={[styles.topbarUnit, { color: colors.subText }]}>
                            Apto. {aptoReal} • {torreReal} • {nombreResidencial}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                            style={[
                                styles.bellBtn,
                                { backgroundColor: colors.inputBg, borderColor: colors.border },
                            ]}
                            onPress={() => setNotifOpen(true)}
                        >
                            <Feather name="bell" size={20} color={colors.text} />
                            {notificaciones.length > 0 && (
                                <View style={[styles.bellBadge, { backgroundColor: colors.danger }]}>
                                    <Text style={styles.bellBadgeText}>{notificaciones.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleLogout}>
                            <Feather name="log-out" size={18} color={colors.danger} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[{ flex: 1 }, !isDesktop && { paddingBottom: Math.max(insets.bottom + 85, 100) }]}>
                    <Slot />
                </View>

                {!isDesktop && (
                    <View
                        style={[
                            styles.bottomNav,
                            {
                                backgroundColor: colors.card,
                                bottom: Math.max(insets.bottom + 15, 20),
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        {navItems.map((item: any) => {
                            const active = item.exact
                                ? pathname === '/' || pathname === '/(propietario)' || pathname === '/(propietario)/'
                                : pathname.includes(item.match);

                            return (
                                <TouchableOpacity
                                    key={item.path}
                                    style={styles.bottomNavItem}
                                    onPress={() => router.push(item.path as any)}
                                >
                                    <View style={{ position: 'relative' }}>
                                        <Feather
                                            name={(item.feather || item.icon) as any}
                                            size={22}
                                            color={active ? colors.primary : colors.subText}
                                        />
                                        {item.badge ? (
                                            <View
                                                style={[
                                                    styles.bottomNavBadge,
                                                    { backgroundColor: colors.danger },
                                                ]}
                                            />
                                        ) : null}
                                    </View>
                                    <Text
                                        style={[
                                            styles.bottomNavText,
                                            { color: active ? colors.primary : colors.subText },
                                            active && { fontWeight: '700' },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {item.label.split(' ')[0]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            <Modal visible={notifOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View
                        style={[
                            styles.notifModal,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                borderWidth: 1,
                            },
                        ]}
                    >
                        <View style={[styles.notifHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="bell" size={18} color={colors.primary} />
                                <Text style={[styles.notifTitle, { color: colors.text }]}>
                                    Centro de Notificaciones
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setNotifOpen(false)}>
                                <Feather name="x" size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 360 }}>
                            {notificaciones.length === 0 ? (
                                <Text
                                    style={{
                                        textAlign: 'center',
                                        marginVertical: 20,
                                        color: colors.subText,
                                    }}
                                >
                                    No tienes notificaciones nuevas.
                                </Text>
                            ) : (
                                notificaciones.map((n) => (
                                    <TouchableOpacity
                                        key={n.id}
                                        style={[
                                            styles.notifItem,
                                            { borderBottomColor: colors.inputBg },
                                        ]}
                                        onPress={() => eliminarNotificacion(n.id, n.ruta)}
                                    >
                                        <View
                                            style={[
                                                styles.notifIconBox,
                                                {
                                                    backgroundColor:
                                                        n.tipo === 'SISTEMA'
                                                            ? colors.primarySoft
                                                            : colors.dangerBg,
                                                },
                                            ]}
                                        >
                                            <Feather
                                                name={n.tipo === 'SISTEMA' ? 'info' : 'alert-circle'}
                                                size={18}
                                                color={
                                                    n.tipo === 'SISTEMA'
                                                        ? colors.primary
                                                        : colors.danger
                                                }
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.notifItemTitle,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                {n.titulo}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.notifItemSub,
                                                    { color: colors.subText },
                                                ]}
                                            >
                                                {n.detalle}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.notifItemTime,
                                                    { color: colors.subText },
                                                ]}
                                            >
                                                {n.fecha?.split(' ')[0] || 'Reciente'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => eliminarNotificacion(n.id, n.ruta)}
                                            style={{ padding: 5 }}
                                        >
                                            <Feather name="x" size={16} color={colors.subText} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ResiAssistantWidget rol="PROPIETARIO" nombreUsuario={session.nombre} />
            <ResiAlertOverlay />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, flexDirection: 'row' },
    sidebar: { width: 260, borderRightWidth: 1, padding: 20, justifyContent: 'space-between' },
    brandBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    logoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    brandTitle: { fontSize: 20, fontWeight: '800' },
    brandSub: { fontSize: 12 },
    unitBanner: { borderRadius: 12, padding: 14, marginBottom: 20 },
    unitBannerName: { fontSize: 14, fontWeight: '800' },
    unitBannerApt: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    unitBannerCondo: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
    menuText: { fontSize: 14, fontWeight: '600' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
    logoutText: { fontSize: 13, fontWeight: '700' },
    topbar: { height: 66, borderBottomWidth: 1, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topbarName: { fontSize: 16, fontWeight: '800' },
    topbarUnit: { fontSize: 12 },
    bellBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    bellBadge: { position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    rolePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
    rolePillText: { fontSize: 11, fontWeight: '800' },
    bottomNav: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: 70,
        borderRadius: 35,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 12,
    },
    bottomNavItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flex: 1,
    },
    bottomNavBadge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4 },
    bottomNavText: { fontSize: 11 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 70, paddingRight: 24 },
    notifModal: { width: 380, maxWidth: '92%', borderRadius: 16, padding: 18, shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
    notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 8 },
    notifTitle: { fontSize: 15, fontWeight: '800' },
    notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    notifIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    notifItemTitle: { fontSize: 13, fontWeight: '700' },
    notifItemSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    notifItemTime: { fontSize: 11, marginTop: 6, fontWeight: '600' },
});