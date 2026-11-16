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
import { useAppTheme } from '../../hooks/useAppTheme';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function AdminLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktop = width >= 900;
    const { colors } = useAppTheme();

    const [session, setSession] = useState<UserSession | null>(null);
    const idResidencial = session?.idResidencial || 1;
    const [notifOpen, setNotifOpen] = useState(false);
    const [periodoActual, setPeriodoActual] = useState('');

    const [infoResidencial, setInfoResidencial] = useState({
        nombre: 'Cargando...',
        detalles: 'Conectando con el servidor...',
    });

    const [notificaciones, setNotificaciones] = useState<any[]>([]);
    const [pendientesCount, setPendientesCount] = useState(0);
    const [averiasCount, setAveriasCount] = useState(0);

    useEffect(() => {
        const current = SessionStore.getSession();
        if (!current) {
            router.replace('/(auth)/login');
            return;
        }
        if (current.rol !== 'ADMIN') {
            router.replace('/(propietario)');
            return;
        }
        setSession(current);

        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ];
        const fecha = new Date();
        setPeriodoActual(`${meses[fecha.getMonth()]} ${fecha.getFullYear()}`);

        // Pasamos el idResidencial real directamente al cargar
        void cargarDatosResidencial(current.idResidencial);
        void cargarNotificaciones(current.idResidencial);
        void registrarPushNotifications(current.id);

        const subscription = Notifications.addNotificationReceivedListener(() => {
            void cargarNotificaciones(current.idResidencial);
            ResiAlert.toast('🔔 Tienes una nueva notificación', 'INFO');
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
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
            if (finalStatus !== 'granted') return;

            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId: 'b05bb0a8-2ac2-4c73-a07e-b929289fee5b',
                });
                const token = tokenData.data;

                await fetch(`${API_BASE}/usuarios/${idUsuario}/token-push`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pushToken: token }),
                });
            } catch (error) {
                console.error('Error al registrar el token de notificaciones:', error);
            }
        }
    };

    // 1. CARGA DINÁMICA USANDO EL ID DEL RESIDENCIAL DE LA SESIÓN
    const cargarDatosResidencial = async (resId: number) => {
        try {
            const response = await fetch(`${API_BASE}/residencial?idResidencial=${resId}`);
            if (response.ok) {
                const data = await response.json();
                setInfoResidencial({
                    nombre: data.nombre || 'Residencial',
                    detalles: `${data.bloques || 'Bloques'} • ${data.totalUnidades || 0} Unidades • ${data.estado || 'Operativo'}`,
                });
            } else {
                setInfoResidencial({ nombre: `Residencial #${resId}`, detalles: 'Modo Local' });
            }
        } catch (error) {
            setInfoResidencial({ nombre: `Residencial #${resId}`, detalles: 'Modo Local' });
        }
    };

    const cargarNotificaciones = async (resId: number) => {
        try {
            const resNotifs = await fetch(`${API_BASE}/notificaciones/admin?idResidencial=${resId}`);
            if (resNotifs.ok) {
                const dataNotifs = await resNotifs.json();
                setNotificaciones(dataNotifs);
                setPendientesCount(dataNotifs.filter((n: any) => n.tipo === 'PAGO').length);
                setAveriasCount(dataNotifs.filter((n: any) => n.tipo === 'AVERIA').length);
            }
        } catch (error) {
            console.log('Error cargando notificaciones de la BD');
        }
    };

    const eliminarNotificacion = async (idNotificacion: number, ruta: string) => {
        try {
            await fetch(`${API_BASE}/notificaciones/${idNotificacion}`, { method: 'DELETE' });
            setNotifOpen(false);
            setNotificaciones(prev => prev.filter(n => n.id !== idNotificacion));
            router.push(ruta as any);
        } catch (error) {
            console.log('Error eliminando notificación');
        }
    };


    const navItems = [
        { label: 'Inicio', icon: 'grid', path: '/(admin)/dashboard', match: 'dashboard' },
        { label: 'Finanzas', feather: 'dollar-sign', path: '/(admin)/finanzas', match: 'finanzas', badge: pendientesCount > 0 ? pendientesCount : null },
        { label: isDesktop ? 'Control Mensual' : 'Pagos', icon: 'Sliders', feather: 'file-text', path: '/(admin)/facturacion', match: 'facturacion' },
        { label: isDesktop ? 'Propietarios' : 'Propietario', feather: 'users', path: '/(admin)/propietarios', match: 'propietarios' },
        { label: 'Reportes', feather: 'tool', path: '/(admin)/reportes', match: 'reportes', badge: averiasCount > 0 ? averiasCount : null },
        { label: 'Reservas', icon: 'calendar', path: '/(admin)/reservas', match: 'reservas'},
        { label: 'Ajustes', feather: 'settings', path: '/(admin)/settings', match: 'settings' },
    ];

    const handleLogout = () => {
        ResiAlert.confirm({
            titulo: 'Cerrar Sesión Segura',
            mensaje: '¿Deseas salir del panel administrativo de ResiFlow?',
            textoConfirmar: 'Sí, Salir',
            peligro: true,
            onConfirm: () => {
                SessionStore.logout();
                router.replace('/(auth)/login');
            },
        });
    };

    if (!session) return null;

    return (
        <View style={[styles.root, { backgroundColor: colors.bg }]}>
            {isDesktop && (
                <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
                    <View>
                        <View style={styles.brandBox}>
                            <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
                                <MaterialCommunityIcons name="home-city-outline" size={24} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.brandTitle, { color: colors.text }]}>ResiFlow</Text>
                                <Text style={[styles.brandSub, { color: colors.subText }]} numberOfLines={1}>{infoResidencial.nombre}</Text>
                            </View>
                        </View>

                        <View style={[styles.roleTag, { backgroundColor: colors.primarySoft }]}>
                            <View style={[styles.roleDot, { backgroundColor: colors.primary }]} />
                            <Text style={[styles.roleTagText, { color: colors.primary }]}>ROL: ENCARGADO / ADMIN</Text>
                        </View>

                        <View style={styles.menuList}>
                            {navItems.map((item) => {
                                const active = pathname.includes(item.match);
                                return (
                                    <TouchableOpacity
                                        key={item.match}
                                        style={[styles.menuItem, active && { backgroundColor: colors.primary }]}
                                        onPress={() => router.push(item.path as any)}
                                    >
                                        <Feather
                                            name={(item.feather || item.icon) as any}
                                            size={19}
                                            color={active ? '#FFFFFF' : colors.subText}
                                        />
                                        <Text style={[styles.menuText, { color: active ? '#FFFFFF' : colors.subText }, active && { fontWeight: '700' }]}>
                                            {item.label}
                                        </Text>
                                        {item.badge ? (
                                            <View style={[styles.menuBadge, { backgroundColor: active ? '#FFFFFF' : colors.danger }]}>
                                                <Text style={[styles.menuBadgeText, { color: active ? colors.primary : '#FFFFFF' }]}>
                                                    {item.badge}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
                        <View style={styles.userCard}>
                            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                                <Text style={[styles.avatarText, { color: colors.primary }]}>{session.nombre.substring(0, 2).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{session.nombre}</Text>
                                <Text style={[styles.userEmail, { color: colors.subText }]} numberOfLines={1}>{session.email}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.dangerBg }]} onPress={handleLogout}>
                            <Feather name="log-out" size={16} color={colors.danger} />
                            <Text style={[styles.logoutText, { color: colors.danger }]}>Cerrar Sesión Segura</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <View style={styles.mainArea}>
                <View style={[
                    styles.topbar,
                    {
                        backgroundColor: colors.card,
                        borderBottomColor: colors.border,
                        paddingTop: isDesktop ? 0 : insets.top,
                        height: isDesktop ? 68 : 68 + insets.top
                    }
                ]}>
                    <View style={styles.topbarLeft}>
                        <View>
                            <Text style={[styles.residentialName, { color: colors.text }]}>{infoResidencial.nombre}</Text>
                            <Text style={[styles.residentialMeta, { color: colors.success }]}>{infoResidencial.detalles}</Text>
                        </View>
                    </View>

                    <View style={styles.topbarRight}>
                        {isDesktop && (
                            <View style={[styles.periodPill, { backgroundColor: colors.inputBg }]}>
                                <Feather name="calendar" size={14} color={colors.primary} />
                                <Text style={[styles.periodText, { color: colors.text }]}>{periodoActual}</Text>
                            </View>
                        )}

                        <TouchableOpacity style={[styles.bellBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setNotifOpen(true)}>
                            <Feather name="bell" size={20} color={colors.text} />
                            {notificaciones.length > 0 && (
                                <View style={[styles.bellBadge, { backgroundColor: colors.danger }]}>
                                    <Text style={styles.bellBadgeText}>{notificaciones.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {!isDesktop && (
                            <TouchableOpacity style={styles.mobileLogout} onPress={handleLogout}>
                                <Feather name="log-out" size={18} color={colors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={[styles.slotContainer, !isDesktop && { paddingBottom: Math.max(insets.bottom + 85, 100) }]}>
                    <Slot />
                </View>

                {!isDesktop && (
                    <View style={[
                        styles.bottomNav,
                        {
                            backgroundColor: colors.card,
                            bottom: Math.max(insets.bottom + 15, 20),
                            borderColor: colors.border
                        }
                    ]}>
                        {navItems.map((item) => {
                            const active = pathname.includes(item.match);
                            return (
                                <TouchableOpacity key={item.match} style={styles.bottomNavItem} onPress={() => router.push(item.path as any)}>
                                    <View style={{ position: 'relative' }}>
                                        <Feather name={(item.feather || item.icon) as any} size={22} color={active ? colors.primary : colors.subText} />
                                        {item.badge ? <View style={[styles.bottomNavBadge, { backgroundColor: colors.danger }]} /> : null}
                                    </View>
                                    <Text
                                        style={[styles.bottomNavText, { color: active ? colors.primary : colors.subText }, active && { fontWeight: '700' }]}
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
                    <View style={[styles.notifModal, { backgroundColor: colors.card }]}>
                        <View style={[styles.notifHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="bell" size={18} color={colors.primary} />
                                <Text style={[styles.notifTitle, { color: colors.text }]}>Centro de Notificaciones</Text>
                            </View>
                            <TouchableOpacity onPress={() => setNotifOpen(false)}>
                                <Feather name="x" size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 360 }}>
                            {notificaciones.length === 0 ? (
                                <Text style={{ textAlign: 'center', marginVertical: 20, color: colors.subText }}>
                                    No hay notificaciones nuevas
                                </Text>
                            ) : (
                                notificaciones.map((n) => (
                                    <TouchableOpacity
                                        key={n.id}
                                        style={[styles.notifItem, { borderBottomColor: colors.inputBg }]}
                                        onPress={() => eliminarNotificacion(n.id, n.ruta)}
                                    >
                                        <View style={[styles.notifIconBox, { backgroundColor: n.tipo === 'PAGO' ? colors.primarySoft : colors.dangerBg }]}>
                                            <Feather name={n.tipo === 'PAGO' ? 'dollar-sign' : 'alert-triangle'} size={18} color={n.tipo === 'PAGO' ? colors.primary : colors.danger} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.notifItemTitle, { color: colors.text }]}>{n.titulo}</Text>
                                            <Text style={[styles.notifItemSub, { color: colors.subText }]}>{n.detalle}</Text>
                                            <Text style={[styles.notifItemTime, { color: colors.subText }]}>{n.fecha?.split(' ')[0] || 'Reciente'}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => eliminarNotificacion(n.id, n.ruta)} style={{ padding: 5 }}>
                                            <Feather name="x" size={16} color={colors.subText} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ResiAssistantWidget rol="ADMIN" nombreUsuario={session.nombre} />
            <ResiAlertOverlay />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, flexDirection: 'row' },
    sidebar: { width: 265, borderRightWidth: 1, padding: 20, justifyContent: 'space-between' },
    brandBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    logoIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    brandTitle: { fontSize: 20, fontWeight: '800' },
    brandSub: { fontSize: 12 },
    roleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 20 },
    roleDot: { width: 7, height: 7, borderRadius: 4 },
    roleTagText: { fontSize: 11, fontWeight: '800' },
    menuList: { gap: 6 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
    menuText: { flex: 1, fontSize: 14, fontWeight: '600' },
    menuBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    menuBadgeText: { fontSize: 11, fontWeight: '800' },
    sidebarFooter: { borderTopWidth: 1, paddingTop: 16, gap: 12 },
    userCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontWeight: '800', fontSize: 14 },
    userName: { fontSize: 13, fontWeight: '700' },
    userEmail: { fontSize: 11 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
    logoutText: { fontSize: 13, fontWeight: '700' },
    mainArea: { flex: 1 },
    topbar: { height: 68, borderBottomWidth: 1, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    residentialName: { fontSize: 16, fontWeight: '800' },
    residentialMeta: { fontSize: 12, fontWeight: '600' },
    topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    periodPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
    periodText: { fontSize: 12, fontWeight: '700' },
    bellBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    bellBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    mobileLogout: { padding: 8 },
    slotContainer: { flex: 1 },
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
    bottomNavText: { fontSize: 11 },
    bottomNavBadge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 70, paddingRight: 24 },
    notifModal: { width: 380, maxWidth: '92%', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
    notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 8 },
    notifTitle: { fontSize: 15, fontWeight: '800' },
    notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    notifIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    notifItemTitle: { fontSize: 13, fontWeight: '700' },
    notifItemSub: { fontSize: 12, marginTop: 2 },
    notifItemTime: { fontSize: 11, marginTop: 4 },
});