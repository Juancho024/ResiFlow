import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    Image,
    TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {SessionStore, ResiAlert, PreferencesStore, AppPreferences, UserSession} from '../(auth)/login';

export default function SettingsScreen() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const esAdmin = session?.rol === 'ADMIN';

    const [darkMode, setDarkMode] = useState(PreferencesStore.get().darkMode);
    const [notifications, setNotifications] = useState(PreferencesStore.get().notifications);
    const [iaActiva, setIaActiva] = useState(PreferencesStore.get().iaActiva);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        const init = PreferencesStore.get();
        setDarkMode(init.darkMode);
        setNotifications(init.notifications);
        setIaActiva(init.iaActiva);

        // AQUÍ ESTÁ EL TIPO AÑADIDO PARA EVITAR EL ERROR TS7006
        return PreferencesStore.subscribe((nuevasPrefs: AppPreferences) => {
            setDarkMode(nuevasPrefs.darkMode);
            setNotifications(nuevasPrefs.notifications);
            setIaActiva(nuevasPrefs.iaActiva);
        });
    }, []);

    // 1. CAMBIAR MODO OSCURO
    const handleToggleDarkMode = (value: boolean) => {
        setDarkMode(value);
        PreferencesStore.set({ darkMode: value });
        ResiAlert.toast(
            value ? '🌙 Modo Oscuro activado' : '☀️ Modo Claro activado',
            'INFO'
        );
    };

    // 2. ACTIVAR / DESACTIVAR NOTIFICACIONES
    const handleToggleNotifications = (value: boolean) => {
        setNotifications(value);
        PreferencesStore.set({ notifications: value });

        if (value) {
            ResiAlert.success(
                'Notificaciones Activadas',
                esAdmin
                    ? 'Recibirás alertas en tiempo real cuando un propietario suba un comprobante de pago o reporte una avería.'
                    : 'Recibirás alertas cuando la administración valide tus pagos, actualice el consumo de gas o publique un aviso.'
            );
        } else {
            ResiAlert.info(
                'Notificaciones Pausadas',
                'Has desactivado las alertas automáticas en este dispositivo.'
            );
        }
    };

    // 3. ACTIVAR / DESACTIVAR ASISTENTE DE IA
    const handleToggleIA = (value: boolean) => {
        setIaActiva(value);
        PreferencesStore.set({ iaActiva: value });

        if (value) {
            ResiAlert.success(
                'Asistente IA Activado',
                esAdmin
                    ? 'El Asistente Inteligente de ResiFlow está activo en tu esquina inferior para ayudarte a auditar cuentas y reportes.'
                    : 'El Asistente Inteligente de ResiFlow está activo en tu pantalla para responder tus dudas sobre cuotas y pagos.'
            );
        } else {
            ResiAlert.info(
                'Asistente IA Desactivado',
                'El botón flotante del asistente ha sido ocultado.'
            );
        }
    };

    // 4. MODAL DE AYUDA Y SOPORTE
    const handleSoporte = () => {
        ResiAlert.info(
            'Ayuda y Soporte • JR Technology',
            'ResiFlow es desarrollado y respaldado por JR Technology CORP.\n\n📧 Correo de soporte: soporte.resiflow@jrtechnology.com\n📱 Instagram / Redes: @juanrijodev\n🛠️ Atención Técnica: Lunes a Sábado (8:00 AM - 6:00 PM)\n\nEstamos disponibles para asistirte con la facturación, validación de vouchers, lecturas de gas o configuración de tu unidad.'
        );
    };

    // 5. MODAL DE TÉRMINOS Y POLÍTICA DE PRIVACIDAD
    const handlePoliticas = () => {
        ResiAlert.info(
            'Términos y Política de Privacidad',
            '1. En ResiFlow protegemos la información financiera y personal de cada condominio bajo estándares de aislamiento seguro.\n\nUso de Datos: Los comprobantes de pago (vouchers), estados de cuenta y lecturas de gas se utilizan exclusivamente para la contabilidad interna de tu residencial.\n\n2. Privacidad: Ningún dato personal, número telefónico o historial bancario es compartido ni comercializado con terceros.\n\n3. Transparencia: Todo pago validado genera un registro auditable para la administración y el propietario.'
        );
    };

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: darkMode ? '#0F172A' : '#F8FAFC' },
            ]}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text
                    style={[
                        styles.headerTitle,
                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                    ]}
                >
                    Configuración
                </Text>
                <Text
                    style={[
                        styles.headerSubtitle,
                        { color: darkMode ? '#94A3B8' : '#64748B' },
                    ]}
                >
                    {esAdmin
                        ? 'Preferencias del Panel de Administración y Alertas del Residencial'
                        : `Preferencias de tu cuenta • ${session?.unidad || 'Portal de Propietario'}`}
                </Text>

                <Text
                    style={[
                        styles.sectionTitle,
                        { color: darkMode ? '#94A3B8' : '#64748B' },
                    ]}
                >
                    Alertas Generales y Apariencia
                </Text>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                            borderColor: darkMode ? '#334155' : '#E2E8F0',
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.settingRow,
                            { borderBottomColor: darkMode ? '#334155' : '#F1F5F9' },
                        ]}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
                                <Ionicons name="moon" size={20} color="#9333EA" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.settingText,
                                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                                    ]}
                                >
                                    Modo Oscuro
                                </Text>
                                <Text
                                    style={[
                                        styles.settingSubText,
                                        { color: darkMode ? '#94A3B8' : '#64748B' },
                                    ]}
                                >
                                    Adapta los colores del programa para descansar la vista
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={handleToggleDarkMode}
                            trackColor={{ false: '#CBD5E1', true: '#3B38F6' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                                <Ionicons name="notifications" size={20} color="#16A34A" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.settingText,
                                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                                    ]}
                                >
                                    Notificaciones del Sistema
                                </Text>
                                <Text
                                    style={[
                                        styles.settingSubText,
                                        { color: darkMode ? '#94A3B8' : '#64748B' },
                                    ]}
                                >
                                    {esAdmin
                                        ? 'Recibir avisos de pagos por validar y averías reportadas'
                                        : 'Recibir avisos de recibos aprobados, gas y comunicados'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: '#CBD5E1', true: '#3B38F6' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                <Text
                    style={[
                        styles.sectionTitle,
                        { color: darkMode ? '#94A3B8' : '#64748B' },
                    ]}
                >
                    Inteligencia Artificial (ResiFlow AI)
                </Text>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                            borderColor: darkMode ? '#334155' : '#E2E8F0',
                        },
                    ]}
                >
                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
                                <MaterialCommunityIcons
                                    name="shimmer"
                                    size={22}
                                    color="#3B38F6"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.settingText,
                                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                                    ]}
                                >
                                    Asistente de IA
                                </Text>
                                <Text
                                    style={[
                                        styles.settingSubText,
                                        { color: darkMode ? '#94A3B8' : '#64748B' },
                                    ]}
                                >
                                    Habilita el botón flotante de consultas y ayuda inteligente
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={iaActiva}
                            onValueChange={handleToggleIA}
                            trackColor={{ false: '#CBD5E1', true: '#3B38F6' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                <Text
                    style={[
                        styles.sectionTitle,
                        { color: darkMode ? '#94A3B8' : '#64748B' },
                    ]}
                >
                    Soporte y Legal
                </Text>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                            borderColor: darkMode ? '#334155' : '#E2E8F0',
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.settingRow,
                            { borderBottomColor: darkMode ? '#334155' : '#F1F5F9' },
                        ]}
                        onPress={handleSoporte}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: '#E0E7FF' }]}>
                                <Ionicons
                                    name="help-buoy-outline"
                                    size={20}
                                    color="#3B38F6"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.settingText,
                                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                                    ]}
                                >
                                    Ayuda y Soporte
                                </Text>
                                <Text
                                    style={[
                                        styles.settingSubText,
                                        { color: darkMode ? '#94A3B8' : '#64748B' },
                                    ]}
                                >
                                    Contacto directo con el equipo técnico de JR Technology
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={darkMode ? '#94A3B8' : '#64748B'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.settingRow, styles.noBorder]}
                        onPress={handlePoliticas}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                                <Ionicons
                                    name="shield-checkmark-outline"
                                    size={20}
                                    color="#15803D"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.settingText,
                                        { color: darkMode ? '#FFFFFF' : '#0F172A' },
                                    ]}
                                >
                                    Términos de Privacidad
                                </Text>
                                <Text
                                    style={[
                                        styles.settingSubText,
                                        { color: darkMode ? '#94A3B8' : '#64748B' },
                                    ]}
                                >
                                    Políticas de seguridad y manejo de datos financieros
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={darkMode ? '#94A3B8' : '#64748B'}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    style={[
                        styles.appInfoContainer,
                        {
                            backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                            borderColor: darkMode ? '#334155' : '#E2E8F0',
                        },
                    ]}
                >
                    <View >
                        {/* Aquí insertas tu imagen local */}
                        <Image
                            source={require('../../assets/images/systemmanager_sinfondo.png')}
                            style={{ width: 32, height: 32, resizeMode: 'contain' }}
                        />
                    </View>

                    <View style={styles.appInfoTextWrapper}>
                        <Text
                            style={[
                                styles.appName,
                                { color: darkMode ? '#FFFFFF' : '#0F172A' },
                            ]}
                        >
                            ResiFlow
                        </Text>
                        <Text
                            style={[
                                styles.appVersion,
                                { color: darkMode ? '#94A3B8' : '#64748B' },
                            ]}
                        >
                            Versión 4.6.0
                        </Text>
                        <Text
                            style={[
                                styles.appVersion,
                                { color: darkMode ? '#94A3B8' : '#64748B' },
                            ]}
                        >
                            Desarrollado por JR Technology S.R.L
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 110,
        maxWidth: 780,
        width: '100%',
        alignSelf: 'center',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 10,
        marginLeft: 4,
    },
    card: {
        borderRadius: 18,
        marginBottom: 24,
        paddingHorizontal: 18,
        borderWidth: 1,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        gap: 12,
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 14,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingText: {
        fontSize: 15,
        fontWeight: '800',
    },
    settingSubText: {
        fontSize: 12,
        marginTop: 2,
        lineHeight: 17,
    },
    appInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginTop: 12,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 18,
        borderWidth: 1,
        gap: 14,
    },
    appLogoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#3B38F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appInfoTextWrapper: {
        alignItems: 'flex-start',
    },
    appName: {
        fontSize: 16,
        fontWeight: '800',
    },
    appVersion: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
});