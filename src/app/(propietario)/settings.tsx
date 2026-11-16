import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {SessionStore, ResiAlert, PreferencesStore, AppPreferences, UserSession} from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function SettingsScreen() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const esAdmin = session?.rol === 'ADMIN';
    const { colors, darkMode } = useAppTheme();

    const [notifications, setNotifications] = useState(PreferencesStore.get().notifications);
    const [iaActiva, setIaActiva] = useState(PreferencesStore.get().iaActiva);

    useEffect(() => {
        const init = PreferencesStore.get();
        setNotifications(init.notifications);
        setIaActiva(init.iaActiva);

        return PreferencesStore.subscribe((nuevasPrefs: AppPreferences) => {
            setNotifications(nuevasPrefs.notifications);
            setIaActiva(nuevasPrefs.iaActiva);
        });
    }, []);

    // 1. CAMBIAR MODO OSCURO
    const handleToggleDarkMode = (value: boolean) => {
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
                    ? 'El Asistente Inteligente de ResiFlow está activo para ayudarte a auditar cuentas, morosos y reportes del residencial.'
                    : 'El Asistente Inteligente de ResiFlow está activo para responder tus dudas sobre cuotas, gas GLP y recibos.'
            );
        } else {
            ResiAlert.info(
                'Asistente IA Desactivado',
                'El asistente inteligente ha sido desactivado temporalmente.'
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
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Configuración
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
                    {esAdmin
                        ? 'Preferencias del Panel de Administración y Alertas del Residencial'
                        : `Preferencias de tu cuenta • ${session?.unidad || 'Portal de Propietario'}`}
                </Text>

                {/* ================================================================ */}
                {/* SECCIÓN 1: APARIENCIA Y NOTIFICACIONES                           */}
                {/* ================================================================ */}
                <Text style={[styles.sectionTitle, { color: colors.subText }]}>
                    Alertas Generales y Apariencia
                </Text>
                <View
                    style={[
                        styles.card,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    {/* MODO OSCURO */}
                    <View
                        style={[
                            styles.settingRow,
                            { borderBottomColor: colors.inputBg },
                        ]}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: darkMode ? '#3B0764' : '#F3E8FF' }]}>
                                <Ionicons name="moon" size={20} color="#A855F7" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingText, { color: colors.text }]}>
                                    Modo Oscuro
                                </Text>
                                <Text style={[styles.settingSubText, { color: colors.subText }]}>
                                    Adapta los colores del programa para descansar la vista
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={handleToggleDarkMode}
                            trackColor={{ false: '#CBD5E1', true: colors.primary }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    {/* NOTIFICACIONES */}
                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: colors.successBg }]}>
                                <Ionicons name="notifications" size={20} color={colors.success} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingText, { color: colors.text }]}>
                                    Notificaciones del Sistema
                                </Text>
                                <Text style={[styles.settingSubText, { color: colors.subText }]}>
                                    {esAdmin
                                        ? 'Recibir avisos de pagos por validar y averías reportadas'
                                        : 'Recibir avisos de recibos aprobados, gas y comunicados'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: '#CBD5E1', true: colors.primary }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                {/* ================================================================ */}
                {/* SECCIÓN 2: INTELIGENCIA ARTIFICIAL                               */}
                {/* ================================================================ */}
                <Text style={[styles.sectionTitle, { color: colors.subText }]}>
                    Inteligencia Artificial (ResiFlow AI)
                </Text>
                <View
                    style={[
                        styles.card,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    <View style={[styles.settingRow, styles.noBorder]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
                                <MaterialCommunityIcons
                                    name="shimmer"
                                    size={22}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingText, { color: colors.text }]}>
                                    Asistente de IA
                                </Text>
                                <Text style={[styles.settingSubText, { color: colors.subText }]}>
                                    Habilita el botón flotante de consultas y ayuda inteligente
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={iaActiva}
                            onValueChange={handleToggleIA}
                            trackColor={{ false: '#CBD5E1', true: colors.primary }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                {/* ================================================================ */}
                {/* SECCIÓN 3: SOPORTE Y LEGAL                                       */}
                {/* ================================================================ */}
                <Text style={[styles.sectionTitle, { color: colors.subText }]}>
                    Soporte y Legal
                </Text>
                <View
                    style={[
                        styles.card,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    {/* AYUDA Y SOPORTE */}
                    <TouchableOpacity
                        style={[
                            styles.settingRow,
                            { borderBottomColor: colors.inputBg },
                        ]}
                        onPress={handleSoporte}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
                                <Ionicons
                                    name="help-buoy-outline"
                                    size={20}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingText, { color: colors.text }]}>
                                    Ayuda y Soporte
                                </Text>
                                <Text style={[styles.settingSubText, { color: colors.subText }]}>
                                    Contacto directo con el equipo técnico de JR Technology
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.subText}
                        />
                    </TouchableOpacity>

                    {/* TÉRMINOS Y PRIVACIDAD */}
                    <TouchableOpacity
                        style={[styles.settingRow, styles.noBorder]}
                        onPress={handlePoliticas}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconBox, { backgroundColor: colors.successBg }]}>
                                <Ionicons
                                    name="shield-checkmark-outline"
                                    size={20}
                                    color={colors.success}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingText, { color: colors.text }]}>
                                    Términos de Privacidad
                                </Text>
                                <Text style={[styles.settingSubText, { color: colors.subText }]}>
                                    Políticas de seguridad y manejo de datos financieros
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.subText}
                        />
                    </TouchableOpacity>
                </View>

                {/* ================================================================ */}
                {/* LABEL INFERIOR: NOMBRE DEL PROGRAMA Y VERSIÓN ACTUAL             */}
                {/* ================================================================ */}
                <View
                    style={[
                        styles.appInfoContainer,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    <View>
                        <Image
                            source={require('../../assets/images/systemmanager_sinfondo.png')}
                            style={{ width: 32, height: 32, resizeMode: 'contain' }}
                        />
                    </View>

                    <View style={styles.appInfoTextWrapper}>
                        <Text style={[styles.appName, { color: colors.text }]}>
                            ResiFlow
                        </Text>
                        <Text style={[styles.appVersion, { color: colors.subText }]}>
                            Versión 4.6.0
                        </Text>
                        <Text style={[styles.appVersion, { color: colors.subText }]}>
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