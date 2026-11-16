import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EnterpriseStore, EmpleadoEmpresa } from './dashboard';

export default function ControlEmpleados() {
    const [empleados, setEmpleados] = useState<EmpleadoEmpresa[]>(EnterpriseStore.getEmpleados());
    const [busqueda, setBusqueda] = useState('');
    const [filtroRol, setFiltroRol] = useState<string>('TODOS');

    // Modal CRUD
    const [modalVisible, setModalVisible] = useState(false);
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [telefono, setTelefono] = useState('');
    const [rol, setRol] = useState<'MECANICO' | 'MANTENIMIENTO' | 'SUPERVISOR' | 'ELECTRICISTA'>('MECANICO');
    const [banco, setBanco] = useState('');
    const [cuentaBanco, setCuentaBanco] = useState('');
    const [tarifaBase, setTarifaBase] = useState('');

    useEffect(() => {
        return EnterpriseStore.subscribe(() => {
            setEmpleados([...EnterpriseStore.getEmpleados()]);
        });
    }, []);

    const abrirNuevo = () => {
        setEditandoId(null);
        setNombre('');
        setCedula('');
        setTelefono('');
        setRol('MECANICO');
        setBanco('Banreservas');
        setCuentaBanco('');
        setTarifaBase('1000');
        setModalVisible(true);
    };

    const abrirEditar = (emp: EmpleadoEmpresa) => {
        setEditandoId(emp.id);
        setNombre(emp.nombre);
        setCedula(emp.cedula);
        setTelefono(emp.telefono);
        setRol(emp.rol);
        setBanco(emp.banco);
        setCuentaBanco(emp.cuentaBanco);
        setTarifaBase(String(emp.tarifaBase));
        setModalVisible(true);
    };

    const guardarEmpleado = () => {
        if (!nombre.trim() || !cedula.trim()) return;

        if (editandoId) {
            EnterpriseStore.actualizarEmpleado(editandoId, {
                nombre,
                cedula,
                telefono,
                rol,
                banco,
                cuentaBanco,
                tarifaBase: parseFloat(tarifaBase) || 800,
            });
        } else {
            EnterpriseStore.agregarEmpleado({
                id: `EMP-${Date.now()}`,
                nombre,
                cedula,
                telefono: telefono || '809-000-0000',
                rol,
                banco: banco || 'Banreservas',
                cuentaBanco: cuentaBanco || '000-000000-0',
                tarifaBase: parseFloat(tarifaBase) || 800,
                saldoBilletera: 0,
                solicitoCobroHoy: false,
                trabajosCompletados: 0,
                estado: 'DISPONIBLE',
            });
        }
        setModalVisible(false);
    };

    const filtrados = empleados.filter((e) => {
        const matchTexto =
            e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            e.cedula.includes(busqueda) ||
            e.rol.toLowerCase().includes(busqueda.toLowerCase());
        const matchRol = filtroRol === 'TODOS' || e.rol === filtroRol;
        return matchTexto && matchRol;
    });

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.pageTitle}>Control de Personal y Técnicos</Text>
                    <Text style={styles.pageSub}>
                        Gestión de mecánicos, limpieza, supervisores y cuentas bancarias de pago diario
                    </Text>
                </View>
                <TouchableOpacity style={styles.newBtn} onPress={abrirNuevo}>
                    <Feather name="user-plus" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>Registrar Empleado</Text>
                </TouchableOpacity>
            </View>

            {/* BUSCADOR Y FILTROS POR ESPECIALIDAD */}
            <View style={styles.searchBar}>
                <Feather name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nombre, cédula o especialidad..."
                    placeholderTextColor="#94A3B8"
                    value={busqueda}
                    onChangeText={setBusqueda}
                />
            </View>

            <View style={styles.pillsRow}>
                {['TODOS', 'MECANICO', 'MANTENIMIENTO', 'SUPERVISOR', 'ELECTRICISTA'].map((r) => (
                    <TouchableOpacity
                        key={r}
                        style={[styles.pill, filtroRol === r && styles.pillActive]}
                        onPress={() => setFiltroRol(r)}
                    >
                        <Text style={[styles.pillText, filtroRol === r && { color: '#FFFFFF' }]}>{r}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* TARJETAS DE EMPLEADOS */}
            <View style={{ gap: 14 }}>
                {filtrados.map((emp) => (
                    <View key={emp.id} style={styles.empCard}>
                        <View style={styles.empTop}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarTxt}>{emp.nombre.substring(0, 2).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.empName}>{emp.nombre}</Text>
                                    <View style={styles.roleTag}>
                                        <Text style={styles.roleTagText}>{emp.rol}</Text>
                                    </View>
                                </View>
                                <Text style={styles.empMeta}>
                                    Cédula: {emp.cedula} • Tel: {emp.telefono}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.stateBadge,
                                    emp.estado === 'EN_CAMPO'
                                        ? { backgroundColor: '#FEF3C7' }
                                        : { backgroundColor: '#DCFCE7' },
                                ]}
                            >
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: '800',
                                        color: emp.estado === 'EN_CAMPO' ? '#B45309' : '#15803D',
                                    }}
                                >
                                    ● {emp.estado.replace('_', ' ')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.finBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.finLbl}>Tarifa Base / Orden</Text>
                                <Text style={styles.finVal}>RD$ {emp.tarifaBase.toLocaleString()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.finLbl}>Billetera Acumulada</Text>
                                <Text style={[styles.finVal, { color: '#15803D' }]}>
                                    RD$ {emp.saldoBilletera.toLocaleString()}
                                </Text>
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <Text style={styles.finLbl}>Cuenta de Desembolso</Text>
                                <Text style={styles.finVal}>
                                    {emp.banco} • {emp.cuentaBanco}
                                </Text>
                            </View>
                            <View style={{ flex: 0.7 }}>
                                <Text style={styles.finLbl}>Órdenes</Text>
                                <Text style={styles.finVal}>{emp.trabajosCompletados} listas</Text>
                            </View>
                        </View>

                        <View style={styles.actionsRow}>
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                                {emp.solicitoCobroHoy
                                    ? '🔔 Solicitó liquidación al final del día'
                                    : 'Acumulando saldo para cobro posterior'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => abrirEditar(emp)}>
                                    <Feather name="edit-2" size={16} color="#475569" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.iconBtn, { backgroundColor: '#FEF2F2' }]}
                                    onPress={() => EnterpriseStore.eliminarEmpleado(emp.id)}
                                >
                                    <Feather name="trash-2" size={16} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {/* MODAL AGREGAR / EDITAR EMPLEADO */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>
                                {editandoId ? 'Editar Ficha de Empleado' : 'Nuevo Empleado / Técnico'}
                            </Text>

                            <Text style={styles.label}>Nombre Completo</Text>
                            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Juan Pérez" />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Cédula</Text>
                                    <TextInput style={styles.input} value={cedula} onChangeText={setCedula} placeholder="031-0000000-0" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Teléfono WhatsApp</Text>
                                    <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="809-000-0000" />
                                </View>
                            </View>

                            <Text style={styles.label}>Especialidad / Rol Operativo</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                                {(['MECANICO', 'MANTENIMIENTO', 'SUPERVISOR', 'ELECTRICISTA'] as const).map((itemRol) => (
                                    <TouchableOpacity
                                        key={itemRol}
                                        style={[styles.pill, rol === itemRol && styles.pillActive]}
                                        onPress={() => setRol(itemRol)}
                                    >
                                        <Text style={[styles.pillText, rol === itemRol && { color: '#FFFFFF' }]}>{itemRol}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Banco</Text>
                                    <TextInput style={styles.input} value={banco} onChangeText={setBanco} placeholder="Banreservas / BHD" />
                                </View>
                                <View style={{ flex: 1.2 }}>
                                    <Text style={styles.label}>Número de Cuenta</Text>
                                    <TextInput style={styles.input} value={cuentaBanco} onChangeText={setCuentaBanco} placeholder="960-000000-0" />
                                </View>
                            </View>

                            <Text style={styles.label}>Tarifa Base por Trabajo Realizado (RD$)</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={tarifaBase}
                                onChangeText={setTarifaBase}
                                placeholder="Ej: 1000"
                            />

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={guardarEmpleado}>
                                    <Text style={styles.saveBtnText}>Guardar Personal</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B' },
    newBtn: { backgroundColor: '#3B38F6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 14, height: 46, marginBottom: 14 },
    searchInput: { flex: 1, height: '100%', fontSize: 14, color: '#0F172A', outlineStyle: 'none' } as any,
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    pillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    empCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
    empTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { fontSize: 16, fontWeight: '800', color: '#3B38F6' },
    empName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    roleTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    roleTagText: { fontSize: 10, fontWeight: '800', color: '#334155' },
    empMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
    stateBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    finBox: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 12, gap: 10 },
    finLbl: { fontSize: 11, color: '#64748B' },
    finVal: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 460, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, height: 42, paddingHorizontal: 12, fontSize: 13, marginBottom: 12, outlineStyle: 'none' } as any,
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: { flex: 1.5, paddingVertical: 12, borderRadius: 10, backgroundColor: '#3B38F6', alignItems: 'center' },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});