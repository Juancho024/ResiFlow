import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ResiAlert, SessionStore, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme'; // <-- INYECTADO

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

interface PropietarioFila {
    id?: number;
    apto: string;
    nombre: string;
    estado: string;
    abonado: number;
    balance: number;
}

const fetchConTimeout = async (url: string) => {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err: any) {
        console.warn(`Red muy lenta o caída en ${url}:`, err.message);
        return { ok: false, json: async () => [] } as any;
    }
};

export default function AdminDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const isDesktop = width >= 1024;
    const { colors, darkMode } = useAppTheme(); // <-- INYECTADO

    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [propietarios, setPropietarios] = useState<PropietarioFila[]>([]);
    const [pagosPendientes, setPagosPendientes] = useState<any[]>([]);
    const [averiasActivas, setAveriasActivas] = useState<any[]>([]);

    const [metricas, setMetricas] = useState({
        totalRecaudado: 0,
        porCobrar: 0,
        aptosEnMora: 0,
        fondoReserva: 0,
    });

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarDashboard(true);
        const intervalo = setInterval(() => {
            void cargarDashboard(false);
        }, 15000);
        return () => clearInterval(intervalo);
    }, []);

    const cargarDashboard = async (esCargaInicial = false) => {
        if (esCargaInicial) setCargando(true);

        const currentResId = SessionStore.getSession()?.idResidencial || idResidencial;
        try {
            const [resProps, resPagos, resReportes] = await Promise.all([
                fetchConTimeout(`${API_BASE}/propietarios?idResidencial=${currentResId}`),
                fetchConTimeout(`${API_BASE}/pagos?idResidencial=${currentResId}`),
                fetchConTimeout(`${API_BASE}/reportes?idResidencial=${currentResId}`),
            ]);

            if (resProps.ok) {
                const dataProps = await resProps.json();
                let sumRecaudado = 0;
                let sumAdeudado = 0;
                let countMorosos = 0;

                const listaMapeada: PropietarioFila[] = dataProps.map((p: any) => {
                    const pagado = parseFloat(p.totalAbonado || p.totalabonado) || 0;
                    const balanceNum = parseFloat(String(p.balance ?? '0')) || 0;

                    sumRecaudado += pagado;
                    if (balanceNum < 0) {
                        sumAdeudado += Math.abs(balanceNum);
                        countMorosos += 1;
                    }

                    return {
                        id: p.id,
                        apto: p.apto || p.numApto || 'S/N',
                        nombre: p.nombre || p.nombrePropietario || 'Residente',
                        estado: balanceNum < 0 ? 'Pendiente' : 'Al día',
                        abonado: pagado,
                        balance: balanceNum,
                    };
                });

                setPropietarios(listaMapeada);
                setMetricas({
                    totalRecaudado: sumRecaudado,
                    porCobrar: sumAdeudado,
                    aptosEnMora: countMorosos,
                    fondoReserva: 0,
                });

                if (resPagos.ok) {
                    const dataPagos = await resPagos.json();
                    const pendientes = dataPagos
                        .filter((p: any) => p.estado === 'PENDIENTE_VALIDACION')
                        .map((p: any) => {
                            const prop = dataProps.find((x: any) => x.id === p.idPropietario);
                            return {
                                id: p.id,
                                apto: prop ? prop.apto || prop.numApto : 'Desc.',
                                propietario: prop ? prop.nombre || prop.nombrePropietario : 'Desc.',
                                concepto: p.concepto,
                                monto: `RD$ ${p.monto.toLocaleString()}`,
                                tipo: p.metodoPago.toUpperCase().includes('EFECTIVO') ? 'EFECTIVO' : 'BANCO',
                            };
                        });
                    setPagosPendientes(pendientes);
                }
            }

            if (resReportes.ok) {
                const dataReportes = await resReportes.json();
                const reportesVivos = dataReportes
                    .filter((r: any) => r.rolAutor === 'PROPIETARIO' && r.estado !== 'Resuelto')
                    .map((r: any) => ({
                        id: r.id,
                        titulo: r.titulo,
                        subtitulo: `Apto ${r.apto} \n${r.descripcion}`,
                        estado: r.estado,
                        color: r.estado === 'Pendiente' ? colors.danger : colors.warning,
                        bg: r.estado === 'Pendiente' ? colors.dangerBg : colors.warningBg,
                    }));
                setAveriasActivas(reportesVivos);
            }
        } catch (error) {
            console.warn('Error general cargando Dashboard:', error);
        } finally {
            if (esCargaInicial) setCargando(false);
        }
    };

    const filasFiltradas = propietarios.filter((item) => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return true;
        return (
            item.nombre.toLowerCase().includes(q) ||
            item.apto.toLowerCase().includes(q) ||
            item.estado.toLowerCase().includes(q)
        );
    });

    if (cargando) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.subText }}>Iniciando Dashboard...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[styles.sectionHeader, { color: colors.subText }]}>MÉTRICAS FINANCIERAS DEL RESIDENCIAL</Text>
                <TouchableOpacity
                    style={[styles.softBlueBtn, { backgroundColor: colors.primarySoft }]}
                    onPress={() => {
                        void cargarDashboard(false);
                        ResiAlert.toast('Métricas sincronizadas en tiempo real', 'INFO');
                    }}
                >
                    <Text style={[styles.softBlueBtnText, { color: colors.primary }]}>↻ Sincronizar Ahora</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.metricsGrid, isDesktop && styles.metricsGridDesktop]}>
                <View style={[styles.metricCardCompact, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.metricCompactLeft}>
                        <View style={[styles.metricIconBox, { backgroundColor: colors.primarySoft }]}>
                            <Feather name="trending-up" size={18} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={[styles.metricCompactLabel, { color: colors.subText }]}>Total Recaudado</Text>
                            <Text style={[styles.metricCompactValue, { color: colors.text }]}>
                                RD$ {metricas.totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.badgeSuccess, { backgroundColor: colors.successBg }]}>
                        <Text style={[styles.badgeSuccessText, { color: colors.success }]}>Histórico</Text>
                    </View>
                </View>

                <View style={[styles.metricCardCompact, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.metricCompactLeft}>
                        <View style={[styles.metricIconBox, { backgroundColor: colors.dangerBg }]}>
                            <Feather name="alert-triangle" size={18} color={colors.danger} />
                        </View>
                        <View>
                            <Text style={[styles.metricCompactLabel, { color: colors.subText }]}>Por Cobrar (Adeudado)</Text>
                            <Text style={[styles.metricCompactValue, { color: colors.danger }]}>
                                RD$ -{metricas.porCobrar.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.badgeDanger, { backgroundColor: colors.dangerBg }]}>
                        <Text style={[styles.badgeDangerText, { color: colors.danger }]}>{metricas.aptosEnMora} en mora</Text>
                    </View>
                </View>

                <View style={[styles.metricCardCompact, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.metricCompactLeft}>
                        <View style={[styles.metricIconBox, { backgroundColor: colors.successBg }]}>
                            <Feather name="briefcase" size={18} color={colors.success} />
                        </View>
                        <View>
                            <Text style={[styles.metricCompactLabel, { color: colors.subText }]}>Fondo de Reserva</Text>
                            <Text style={[styles.metricCompactValue, { color: colors.text }]}>
                                RD$ {metricas.fondoReserva.toFixed(2)}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.badgeInfo, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.badgeInfoText, { color: colors.primary }]}>Caja Neta</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.mainColumns, isDesktop && styles.mainColumnsDesktop]}>
                <View style={[{ gap: 20 }, isDesktop && { flex: 1.35 }]}>
                    <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.tableCardTopHeader}>
                            <View>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Balance de Propietarios</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Estado financiero de las {propietarios.length} unidades</Text>
                            </View>
                            <TouchableOpacity style={[styles.softBlueBtn, { backgroundColor: colors.primarySoft }]} onPress={() => router.push('/(admin)/propietarios')}>
                                <Text style={[styles.softBlueBtnText, { color: colors.primary }]}>Ver Directorio</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <TextInput
                                style={[styles.searchInputDirect, { color: colors.text }]}
                                placeholder="Filtrar por propietario, apartamento o estado..."
                                placeholderTextColor={colors.subText}
                                value={busqueda}
                                onChangeText={setBusqueda}
                            />
                        </View>

                        <View style={[styles.tableHeaderRow, { backgroundColor: colors.inputBg }]}>
                            <Text style={[styles.thText, { flex: 0.70, color: colors.subText }]}>UNIDAD</Text>
                            <Text style={[styles.thText, { flex: 1.2, color: colors.subText }]}>PROPIETARIO</Text>
                            <Text style={[styles.thText, { flex: 1.5, textAlign: 'right', color: colors.subText }]}>ABONADO</Text>
                            <Text style={[styles.thText, { flex: 1.5, textAlign: 'right', color: colors.subText }]}>BALANCE</Text>
                        </View>

                        {filasFiltradas.length === 0 && <Text style={[styles.emptyText, { color: colors.subText }]}>No hay propietarios registrados.</Text>}
                        {filasFiltradas.map((item, idx) => {
                            const esPendiente = item.balance < 0;
                            return (
                                <View key={item.apto} style={[styles.tableDataRow, { borderBottomColor: colors.inputBg }, idx % 2 === 1 && { backgroundColor: darkMode ? colors.inputBg : '#F8FAFC' }]}>
                                    <View style={{ flex: 0.65 }}>
                                        <View style={[styles.aptoBadge, { backgroundColor: esPendiente ? colors.dangerBg : colors.primarySoft }]}>
                                            <Text style={[styles.aptoBadgeText, { color: esPendiente ? colors.danger : colors.primary }]}>{item.apto}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.tdNameText, { flex: 1.2, color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
                                    <Text style={[styles.tdRight, { flex: 1.5, color: colors.subText }]} numberOfLines={1}>
                                        RD$ {item.abonado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>
                                    <Text numberOfLines={1} style={[styles.tdRightBold, { flex: 1.5, color: esPendiente ? colors.danger : colors.success }]}>
                                        {item.balance >= 0 ? '+' : ''}RD$ {item.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <View style={[styles.urgentValidationBox, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
                        <View style={styles.urgentHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={[styles.urgentIconCircle, { backgroundColor: colors.dangerBg }]}>
                                    <Feather name="clipboard" size={16} color={colors.danger} />
                                </View>
                                <View>
                                    <Text style={[styles.urgentTitle, { color: colors.text }]}>{pagosPendientes.length} Pagos por validar</Text>
                                    <Text style={[styles.urgentSub, { color: colors.subText }]}>Transferencias recibidas de la app</Text>
                                </View>
                            </View>
                            {pagosPendientes.length > 0 && (
                                <View style={[styles.badgeDanger, { backgroundColor: colors.dangerBg }]}>
                                    <Text style={[styles.badgeDangerText, { color: colors.danger }]}>Urgente</Text>
                                </View>
                            )}
                        </View>

                        {pagosPendientes.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.subText }]}>No hay pagos pendientes de validación.</Text>
                        ) : (
                            pagosPendientes.map((p) => (
                                <View key={p.id} style={[styles.validationRowCard, { backgroundColor: colors.card }]}>
                                    <View style={[styles.validationLeftIcon, { backgroundColor: colors.inputBg }]}>
                                        <Feather name={p.tipo === 'BANCO' ? 'file-text' : 'dollar-sign'} size={18} color={p.tipo === 'BANCO' ? colors.primary : colors.success} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.validationApto, { color: colors.text }]}>{p.apto} • {p.propietario}</Text>
                                        <Text style={[styles.validationConcept, { color: colors.subText }]} numberOfLines={1}>{p.concepto}</Text>
                                    </View>
                                    <Text style={[styles.validationAmount, { color: colors.text }]}>{p.monto}</Text>
                                    <TouchableOpacity style={[styles.validateActionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(admin)/finanzas')}>
                                        <Text style={styles.validateActionText}>Validar</Text>
                                        <Feather name="chevron-right" size={14} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                <View style={[{ gap: 20 }, isDesktop && { flex: 0.95 }]}>
                    <View style={[styles.whiteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={[styles.iconSoftBlue, { backgroundColor: colors.primarySoft }]}>
                                    <Feather name="tool" size={18} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>Averías Activas</Text>
                                    <Text style={[styles.cardSubtitle, { color: colors.subText }]}>{averiasActivas.length} incidencias reportadas</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={[styles.softBlueBtn, { backgroundColor: colors.primarySoft }]} onPress={() => router.push('/(admin)/reportes')}>
                                <Text style={[styles.softBlueBtnText, { color: colors.primary }]}>Gestionar</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 10, marginTop: 14 }}>
                            {averiasActivas.length === 0 ? (
                                <Text style={[styles.emptyText, { color: colors.subText }]}>No hay averías activas reportadas.</Text>
                            ) : (
                                averiasActivas.map((av) => (
                                    <View key={av.id} style={[styles.issueItem, { backgroundColor: colors.inputBg, borderLeftColor: av.color }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.issueTitle, { color: colors.text }]}>{av.titulo}</Text>
                                            <Text style={[styles.issueSub, { color: colors.subText }]} numberOfLines={2}>{av.subtitulo}</Text>
                                        </View>
                                        <View style={[styles.issueBadge, { backgroundColor: av.bg }]}>
                                            <Text style={[styles.issueBadgeText, { color: av.color }]}>{av.estado}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 48 },
    emptyText: { textAlign: 'center', marginVertical: 15, fontStyle: 'italic', fontSize: 13 },
    sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    metricsGrid: { gap: 12, marginBottom: 20 },
    metricsGridDesktop: { flexDirection: 'row' },
    metricCardCompact: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    metricCompactLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metricIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    metricCompactLabel: { fontSize: 12, fontWeight: '600' },
    metricCompactValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
    badgeSuccess: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeSuccessText: { fontSize: 10, fontWeight: '800' },
    badgeDanger: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeDangerText: { fontSize: 10, fontWeight: '800' },
    badgeInfo: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeInfoText: { fontSize: 10, fontWeight: '800' },
    mainColumns: { gap: 20 },
    mainColumnsDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
    tableCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
    tableCardTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    searchBarContainer: { borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 14 },
    searchInputDirect: { width: '100%', height: '100%', fontSize: 13, paddingVertical: 0, outlineStyle: 'none' } as any,
    tableHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
    thText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
    tableDataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderRadius: 8 },
    aptoBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    aptoBadgeText: { fontSize: 11, fontWeight: '800' },
    tdNameText: { fontSize: 13, fontWeight: '700' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    statusDot: { width: 5, height: 5, borderRadius: 2.5 },
    statusPillText: { fontSize: 10, fontWeight: '800' },
    tdRight: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
    tdRightBold: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
    urgentValidationBox: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 10 },
    urgentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    urgentIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    urgentTitle: { fontSize: 15, fontWeight: '800' },
    urgentSub: { fontSize: 12 },
    validationRowCard: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    validationLeftIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    validationApto: { fontSize: 13, fontWeight: '700' },
    validationConcept: { fontSize: 11 },
    validationAmount: { fontSize: 13, fontWeight: '800' },
    validateActionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
    validateActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    whiteCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconSoftBlue: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '800' },
    cardSubtitle: { fontSize: 12, marginTop: 1 },
    softBlueBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    softBlueBtnText: { fontSize: 12, fontWeight: '700' },
    issueItem: { borderRadius: 12, padding: 13, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
    issueTitle: { fontSize: 13, fontWeight: '700' },
    issueSub: { fontSize: 11, marginTop: 2 },
    issueBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
    issueBadgeText: { fontSize: 11, fontWeight: '800' },
});