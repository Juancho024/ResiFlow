import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
    ScrollView, Platform,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SessionStore, UserSession } from '../(auth)/login';

export default function EmpresaLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;

    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;

    useEffect(() => {
        if (Platform.OS !== 'web') {
            // Lo pateamos inmediatamente de vuelta al login
            router.replace('/(auth)/login');
        }
        const current = SessionStore.getSession();
        if (!current) {
            setSession(current);
            router.replace('/(auth)/login');
            return;
        }
        setSession(current);
    }, [pathname]);

    if (Platform.OS !== 'web') return null;

    // Menú corporativo completo para la empresa Master
    const navItems = [
        { label: 'Dashboard Master', icon: 'grid', path: '/(empresa)/dashboard', match: 'dashboard' },
        { label: 'Control Residenciales', icon: 'home', path: '/(empresa)/ControlResidencial', match: 'ControlResidencial' },
        { label: 'Facturación SaaS & MRR', icon: 'trending-up', path: '/(empresa)/FacturacionSaaS', match: 'FacturacionSaaS' },
        { label: 'Gestión de Personal', icon: 'users', path: '/(empresa)/ControlEmpleados', match: 'ControlEmpleados' },
        { label: 'Gastos, Servicios & DGII', icon: 'file-text', path: '/(empresa)/ControlGastos', match: 'ControlGastos' },
        { label: 'Órdenes y Reservas', icon: 'calendar', path: '/(empresa)/ControlReservas', match: 'ControlReservas' },
        { label: 'Nómina & Pagos Diarios', icon: 'dollar-sign', path: '/(empresa)/Nomina', match: 'Nomina' },
        { label: 'Control de Usuarios', icon: 'shield', path: '/(empresa)/ControlUsuario', match: 'ControlUsuario' },
    ];

    const handleLogout = () => {
        SessionStore.logout();
        router.replace('/(auth)/login');
    };

    if (!session) return null;

    return (
        <View style={styles.root}>
            {/* SIDEBAR CORPORATIVO (PC) */}
            {isDesktop && (
                <View style={styles.sidebar}>
                    {/* ZONA SCROLLABLE PARA EL MENÚ Y BRANDING */}
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        <View style={styles.brandBox}>
                            <View style={styles.logoIcon}>
                                <MaterialCommunityIcons name="home-city-outline" size={24} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.brandTitle}>ResiFlow</Text>
                                <Text style={styles.brandSub}>Panel de Control Master</Text>
                            </View>
                        </View>

                        <View style={styles.roleTag}>
                            <View style={styles.roleDot} />
                            <Text style={styles.roleTagText}>MODO: CORPORATIVO SEGURO</Text>
                        </View>

                        <View style={styles.menuList}>
                            {navItems.map((item) => {
                                const active = pathname.includes(item.match);
                                return (
                                    <TouchableOpacity
                                        key={item.match}
                                        style={[styles.menuItem, active && styles.menuItemActive]}
                                        onPress={() => router.push(item.path as any)}
                                    >
                                        <Feather
                                            name={item.icon as any}
                                            size={18}
                                            color={active ? '#FFFFFF' : '#64748B'}
                                        />
                                        <Text style={[styles.menuText, active && styles.menuTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* ZONA FIJA PARA EL PIE DE PÁGINA */}
                    <View style={styles.sidebarFooter}>
                        <View style={styles.userCard}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{session.nombre.substring(0, 2).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.userName} numberOfLines={1}>{session.nombre}</Text>
                                <Text style={styles.userEmail} numberOfLines={1}>Administrador Master</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <Feather name="log-out" size={16} color="#EF4444" />
                            <Text style={styles.logoutText}>Cerrar Sesión Corporativa</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* CONTENIDO PRINCIPAL */}
            <View style={styles.mainArea}>
                <View style={styles.topbar}>
                    <View style={styles.topbarLeft}>
                        <Text style={styles.topbarTitle}>ResiFlow Enterprise</Text>
                        <Text style={styles.topbarSubtitle}>Desarrollado por JR Technology</Text>
                    </View>
                </View>

                <View style={styles.slotContainer}>
                    <Slot />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC' },
    sidebar: {
        width: 280,
        backgroundColor: '#0F172A',
        borderRightWidth: 1,
        borderRightColor: '#1E293B',
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 16,
        justifyContent: 'space-between',
    },
    brandBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    logoIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#3B38F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    brandSub: { fontSize: 11, color: '#94A3B8' },
    roleTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(59, 56, 246, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#3B38F6',
    },
    roleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
    roleTagText: { fontSize: 10, fontWeight: '800', color: '#A5B4FC' },
    menuList: { gap: 6 },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    menuItemActive: { backgroundColor: '#3B38F6' },
    menuText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    menuTextActive: { color: '#FFFFFF', fontWeight: '700' },
    sidebarFooter: { borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 16, gap: 12 },
    userCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#312E81',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: '#A5B4FC', fontWeight: '800', fontSize: 14 },
    userName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    userEmail: { fontSize: 11, color: '#94A3B8' },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    logoutText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
    mainArea: { flex: 1 },
    topbar: {
        height: 68,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingHorizontal: 28,
        justifyContent: 'center',
    },
    topbarLeft: { gap: 2 },
    topbarTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    topbarSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    slotContainer: { flex: 1 },
});