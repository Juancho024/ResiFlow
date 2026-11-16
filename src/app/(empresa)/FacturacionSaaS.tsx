import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Modal,
    TextInput,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface SuscripcionCliente {
    id: string;
    residencial: string;
    plan: string;
    cuotaMensual: number;
    estadoMesActual: 'PAGADO' | 'PENDIENTE' | 'ATRASADO';
    fechaVencimiento: string;
    ultimoPago?: string;
}

export default function FacturacionSaaS() {
    const [clientes, setClientes] = useState<SuscripcionCliente[]>([
        {
            id: 'RES-01',
            residencial: 'Residencial Santos I',
            plan: 'Plan Base (Software + Soporte)',
            cuotaMensual: 2500,
            estadoMesActual: 'PENDIENTE',
            fechaVencimiento: '05/11/2026',
        },
        {
            id: 'RES-02',
            residencial: 'Residencial Las Acacias',
            plan: 'Plan Base (Software + Soporte)',
            cuotaMensual: 2500,
            estadoMesActual: 'PAGADO',
            fechaVencimiento: '05/11/2026',
            ultimoPago: '02/11/2026',
        },
        {
            id: 'RES-03',
            residencial: 'Torre Mirador',
            plan: 'Plan Premium (Software + Auditoría)',
            cuotaMensual: 4000,
            estadoMesActual: 'ATRASADO',
            fechaVencimiento: '01/10/2026',
        },
    ]);

    const [modalVisible, setModalVisible] = useState(false);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<SuscripcionCliente | null>(null);
    const [referencia, setReferencia] = useState('');

    const MRR = clientes.reduce((acc, curr) => acc + curr.cuotaMensual, 0);
    const cobradoEsteMes = clientes.filter(c => c.estadoMesActual === 'PAGADO').reduce((acc, curr) => acc + curr.cuotaMensual, 0);
    const pendientePorCobrar = MRR - cobradoEsteMes;

    const abrirModalCobro = (cliente: SuscripcionCliente) => {
        setClienteSeleccionado(cliente);
        setReferencia('');
        setModalVisible(true);
    };

    const registrarCobroIguala = () => {
        if (!clienteSeleccionado) return;

        setClientes(clientes.map(c =>
            c.id === clienteSeleccionado.id
                ? { ...c, estadoMesActual: 'PAGADO', ultimoPago: new Date().toLocaleDateString() }
                : c
        ));

        // Aquí iría el fetch() a tu API Master para guardar el ingreso en la empresa
        // Y un trigger en el backend que inserte este pago como "Gasto" en el residencial correspondiente

        setModalVisible(false);
        alert(`Cobro de RD$ ${clienteSeleccionado.cuotaMensual} registrado con éxito. El fondo del residencial ha sido debitado.`);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.pageTitle}>Facturación SaaS & MRR</Text>
                    <Text style={styles.pageSub}>Control de Igualas Mensuales y Cobros a Condominios Clientes</Text>
                </View>
                <TouchableOpacity style={styles.newBtn}>
                    <Feather name="file-text" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>Generar Facturas del Mes</Text>
                </TouchableOpacity>
            </View>

            {/* KPIs DE INGRESOS RECURRENTES (MRR) */}
            <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>MRR (INGRESO RECURRENTE MENSUAL)</Text>
                    <Text style={[styles.kpiVal, { color: '#0F172A' }]}>
                        RD$ {MRR.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Total facturado a {clientes.length} clientes</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>COBRADO ESTE MES</Text>
                    <Text style={[styles.kpiVal, { color: '#15803D' }]}>
                        RD$ {cobradoEsteMes.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>En cuenta bancaria JR Tech</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>PENDIENTE DE COBRO</Text>
                    <Text style={[styles.kpiVal, { color: '#DC2626' }]}>
                        RD$ {pendientePorCobrar.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Facturas en tránsito o atrasadas</Text>
                </View>
            </View>

            {/* TABLA DE COBROS A RESIDENCIALES */}
            <View style={styles.tableCard}>
                <Text style={styles.cardTitle}>Estado de Cuentas B2B (Clientes Activos)</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 14 }}>
                    <View style={{ minWidth: 800 }}>
                        <View style={styles.thRow}>
                            <Text style={[styles.th, { flex: 1.5 }]}>CLIENTE / RESIDENCIAL</Text>
                            <Text style={[styles.th, { flex: 1 }]}>IGUALA MENSUAL</Text>
                            <Text style={[styles.th, { flex: 1 }]}>VENCIMIENTO</Text>
                            <Text style={[styles.th, { flex: 1 }]}>ESTADO MES ACTUAL</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>ACCIÓN</Text>
                        </View>

                        {clientes.map((c) => (
                            <View key={c.id} style={styles.trRow}>
                                <View style={{ flex: 1.5, paddingRight: 10 }}>
                                    <Text style={styles.tdBold}>{c.residencial}</Text>
                                    <Text style={styles.tdMeta}>{c.plan}</Text>
                                </View>

                                <Text style={[styles.tdBold, { flex: 1, color: '#15803D' }]}>
                                    RD$ {c.cuotaMensual.toLocaleString()}
                                </Text>

                                <Text style={[styles.td, { flex: 1 }]}>Los días {c.fechaVencimiento.split('/')[0]}</Text>

                                <View style={{ flex: 1 }}>
                                    <View style={[styles.estadoPill,
                                        c.estadoMesActual === 'PAGADO' ? { backgroundColor: '#DCFCE7' } :
                                            c.estadoMesActual === 'PENDIENTE' ? { backgroundColor: '#FEF3C7' } :
                                                { backgroundColor: '#FEE2E2' }
                                    ]}>
                                        <Text style={[styles.estadoTxt,
                                            c.estadoMesActual === 'PAGADO' ? { color: '#15803D' } :
                                                c.estadoMesActual === 'PENDIENTE' ? { color: '#B45309' } :
                                                    { color: '#DC2626' }
                                        ]}>{c.estadoMesActual}</Text>
                                    </View>
                                </View>

                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    {c.estadoMesActual !== 'PAGADO' ? (
                                        <TouchableOpacity
                                            style={styles.cobrarBtn}
                                            onPress={() => abrirModalCobro(c)}
                                        >
                                            <Feather name="check" size={14} color="#FFFFFF" />
                                            <Text style={styles.cobrarBtnTxt}>Registrar Pago</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>
                                            Pagó el {c.ultimoPago}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* MODAL CONFIRMAR COBRO DE IGUALA */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Registrar Cobro de Iguala</Text>
                                <Text style={styles.modalSub}>{clienteSeleccionado?.residencial}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.resumenCobro}>
                            <Text style={styles.resumenLbl}>Monto a debitar del residencial e ingresar a la empresa:</Text>
                            <Text style={styles.resumenVal}>RD$ {clienteSeleccionado?.cuotaMensual.toLocaleString()}</Text>
                        </View>

                        <Text style={styles.label}>Referencia de Transferencia / Nota (Opcional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Transferencia BHD 991823"
                            value={referencia}
                            onChangeText={setReferencia}
                        />

                        <Text style={styles.helperText}>
                            Al confirmar, este pago se registrará como ingreso para JR Technology y como gasto operativo automático en el libro financiero de {clienteSeleccionado?.residencial}.
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelTxt}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={registrarCobroIguala}>
                                <Feather name="dollar-sign" size={16} color="#FFFFFF" />
                                <Text style={styles.saveTxt}>Confirmar Cobro</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, paddingBottom: 48, gap: 18 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    newBtn: { backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    kpiCard: { flex: 1, minWidth: 220, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
    kpiLbl: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
    kpiVal: { fontSize: 24, fontWeight: '900', marginVertical: 6 },
    kpiSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    tableCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    thRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginTop: 10 },
    th: { color: '#475569', fontSize: 10, fontWeight: '800' },
    trRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    td: { fontSize: 13, color: '#334155' },
    tdBold: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    tdMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
    estadoPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    estadoTxt: { fontSize: 10, fontWeight: '900' },
    cobrarBtn: { backgroundColor: '#3B38F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cobrarBtnTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 12, color: '#3B38F6', fontWeight: '800', marginTop: 2 },
    resumenCobro: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    resumenLbl: { fontSize: 11, color: '#64748B', fontWeight: '700' },
    resumenVal: { fontSize: 22, fontWeight: '900', color: '#15803D', marginTop: 4 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 13, marginBottom: 12, outlineStyle: 'none' } as any,
    helperText: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginBottom: 16, lineHeight: 16 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: { flex: 1.5, paddingVertical: 12, borderRadius: 10, backgroundColor: '#15803D', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    saveTxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});