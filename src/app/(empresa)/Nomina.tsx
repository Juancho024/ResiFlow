import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EnterpriseStore, EmpleadoEmpresa, HistorialPagoNomina } from './dashboard';

export default function NominaScreen() {
    const [empleados, setEmpleados] = useState<EmpleadoEmpresa[]>(EnterpriseStore.getEmpleados());
    const [historial, setHistorial] = useState<HistorialPagoNomina[]>(EnterpriseStore.getHistorialNomina());
    const [tab, setTab] = useState<'BILLETERAS' | 'HISTORIAL'>('BILLETERAS');

    useEffect(() => {
        return EnterpriseStore.subscribe(() => {
            setEmpleados([...EnterpriseStore.getEmpleados()]);
            setHistorial([...EnterpriseStore.getHistorialNomina()]);
        });
    }, []);

    const totalPendiente = empleados.reduce((acc, e) => acc + e.saldoBilletera, 0);
    const totalPagadoMes = historial.reduce((acc, h) => acc + h.totalPagado, 0);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.pageTitle}>Nómina Dinámica & Worker Wallet</Text>
                    <Text style={styles.pageSub}>
                        Liquidación diaria por trabajo terminado o acumulación voluntaria de saldo
                    </Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLbl}>SALDO ACUMULADO EN BILLETERAS</Text>
                    <Text style={[styles.statVal, { color: '#DC2626' }]}>RD$ {totalPendiente.toLocaleString()}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLbl}>LIQUIDADO ESTE MES</Text>
                    <Text style={[styles.statVal, { color: '#15803D' }]}>RD$ {totalPagadoMes.toLocaleString()}</Text>
                </View>
            </View>

            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'BILLETERAS' && styles.tabActive]}
                    onPress={() => setTab('BILLETERAS')}
                >
                    <Text style={[styles.tabText, tab === 'BILLETERAS' && { color: '#FFFFFF' }]}>
                        Billeteras de Empleados ({empleados.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'HISTORIAL' && styles.tabActive]}
                    onPress={() => setTab('HISTORIAL')}
                >
                    <Text style={[styles.tabText, tab === 'HISTORIAL' && { color: '#FFFFFF' }]}>
                        Comprobantes Emitidos ({historial.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === 'BILLETERAS' ? (
                <View style={{ gap: 14 }}>
                    {empleados.map((e) => (
                        <View key={e.id} style={styles.walletRow}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.empName}>{e.nombre}</Text>
                                    {e.solicitoCobroHoy && e.saldoBilletera > 0 && (
                                        <View style={styles.urgentTag}>
                                            <Text style={styles.urgentTagText}>COBRAR HOY</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.empMeta}>
                                    {e.rol} • Cuenta: {e.banco} ({e.cuentaBanco}) • {e.trabajosCompletados} trabajos históricos
                                </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                <Text style={styles.amount}>RD$ {e.saldoBilletera.toLocaleString()}</Text>
                                <TouchableOpacity
                                    style={[styles.payBtn, e.saldoBilletera === 0 && { backgroundColor: '#CBD5E1' }]}
                                    disabled={e.saldoBilletera === 0}
                                    onPress={() => EnterpriseStore.liquidarEmpleado(e.id)}
                                >
                                    <Feather name="send" size={14} color="#FFFFFF" />
                                    <Text style={styles.payBtnText}>
                                        {e.saldoBilletera > 0 ? 'Liquidar y Transferir' : 'Al Día'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    {historial.map((h) => (
                        <View key={h.id} style={styles.walletRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.empName}>{h.nombreEmpleado} ({h.rol})</Text>
                                <Text style={styles.empMeta}>
                                    Fecha: {h.fecha} • Destino: {h.banco} • Ref: {h.referencia}
                                </Text>
                            </View>
                            <Text style={[styles.amount, { color: '#15803D' }]}>
                                RD$ {h.totalPagado.toLocaleString()} ✓
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, paddingBottom: 48 },
    headerRow: { marginBottom: 18 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B' },
    statsRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    statLbl: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    statVal: { fontSize: 24, fontWeight: '800', marginTop: 4 },
    tabsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' },
    tabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    walletRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    empName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    empMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
    urgentTag: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    urgentTagText: { color: '#DC2626', fontSize: 10, fontWeight: '800' },
    amount: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    payBtn: { backgroundColor: '#3B38F6', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
    payBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});