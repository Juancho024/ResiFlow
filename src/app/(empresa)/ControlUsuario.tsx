import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EnterpriseStore, EmpleadoEmpresa } from './dashboard';

const JERARQUIA_ROLES: EmpleadoEmpresa['rolSistema'][] = [
    'EMPLEADO_CAMPO',
    'SUPERVISOR',
    'ADMIN_RESIDENCIAL',
    'MASTER_ADMIN',
];

const MODULOS_SISTEMA = ['App Campo', 'Reservas', 'Residenciales', 'Nómina', 'Finanzas', 'Auditoría'];

export default function ControlUsuario() {
    const [empleados, setEmpleados] = useState<EmpleadoEmpresa[]>(EnterpriseStore.getEmpleados());
    const [busqueda, setBusqueda] = useState('');

    // Modal para editar credenciales (Usuario, Contraseña y Rol)
    const [modalVisible, setModalVisible] = useState(false);
    const [empEditando, setEmpEditando] = useState<EmpleadoEmpresa | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editRolSistema, setEditRolSistema] = useState<EmpleadoEmpresa['rolSistema']>('EMPLEADO_CAMPO');

    useEffect(() => {
        return EnterpriseStore.subscribe(() => {
            setEmpleados([...EnterpriseStore.getEmpleados()]);
        });
    }, []);

    // Subir o bajar de rol en la jerarquía
    const cambiarNivelRol = (emp: EmpleadoEmpresa, direccion: 'SUBIR' | 'BAJAR') => {
        const idxActual = JERARQUIA_ROLES.indexOf(emp.rolSistema);
        const nuevoIdx =
            direccion === 'SUBIR'
                ? Math.min(JERARQUIA_ROLES.length - 1, idxActual + 1)
                : Math.max(0, idxActual - 1);

        const nuevoRol = JERARQUIA_ROLES[nuevoIdx];
        EnterpriseStore.actualizarEmpleado(emp.id, { rolSistema: nuevoRol });
    };

    // Activar o desactivar acceso a un módulo del sistema
    const togglePermisoModulo = (emp: EmpleadoEmpresa, modulo: string) => {
        const tienePermiso = emp.permisos.includes(modulo);
        const nuevosPermisos = tienePermiso
            ? emp.permisos.filter((m) => m !== modulo)
            : [...emp.permisos, modulo];

        EnterpriseStore.actualizarEmpleado(emp.id, { permisos: nuevosPermisos });
    };

    const abrirModalCredenciales = (emp: EmpleadoEmpresa) => {
        setEmpEditando(emp);
        setEditUsername(emp.username);
        setEditPassword(emp.password || '');
        setEditRolSistema(emp.rolSistema);
        setModalVisible(true);
    };

    const guardarCredenciales = () => {
        if (!empEditando || !editUsername.trim()) return;
        EnterpriseStore.actualizarEmpleado(empEditando.id, {
            username: editUsername.trim(),
            password: editPassword.trim() || empEditando.password,
            rolSistema: editRolSistema,
        });
        setModalVisible(false);
    };

    const filtrados = empleados.filter(
        (e) =>
            e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            e.username.toLowerCase().includes(busqueda.toLowerCase()) ||
            e.rolSistema.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.pageTitle}>Matriz de Control de Usuarios y Accesos (RBAC)</Text>
                    <Text style={styles.pageSub}>
                        Sube o baja de rango a tus empleados, habilita módulos del sistema y cambia usuarios o contraseñas
                    </Text>
                </View>
            </View>

            {/* BUSCADOR */}
            <View style={styles.searchBar}>
                <Feather name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Filtrar por empleado, usuario (@login) o nivel de acceso..."
                    placeholderTextColor="#94A3B8"
                    value={busqueda}
                    onChangeText={setBusqueda}
                />
            </View>

            {/* TABLA CORPORATIVA DE EMPLEADOS Y PERMISOS */}
            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ minWidth: 980 }}>
                        {/* ENCABEZADO DE LA TABLA */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: 220 }]}>EMPLEADO / CREDENCIAL</Text>
                            <Text style={[styles.th, { width: 220 }]}>NIVEL DE ROL (SUBIR / BAJAR)</Text>
                            <Text style={[styles.th, { width: 340 }]}>ACCESO A MÓDULOS DEL SISTEMA</Text>
                            <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>ESTADO</Text>
                            <Text style={[styles.th, { width: 120, textAlign: 'right' }]}>SEGURIDAD</Text>
                        </View>

                        {/* FILAS DE EMPLEADOS */}
                        {filtrados.map((emp, idx) => (
                            <View
                                key={emp.id}
                                style={[
                                    styles.tableRow,
                                    idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                                ]}
                            >
                                {/* 1. Empleado y Usuario */}
                                <View style={{ width: 220, paddingRight: 10 }}>
                                    <Text style={styles.empName}>{emp.nombre}</Text>
                                    <Text style={styles.empUser}>
                                        @{emp.username} • {emp.rol}
                                    </Text>
                                </View>

                                {/* 2. Rol + Botones Subir / Bajar */}
                                <View style={{ width: 220, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={styles.roleBadge}>
                                        <Text style={styles.roleBadgeText}>{emp.rolSistema}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.rankBtn}
                                        onPress={() => cambiarNivelRol(emp, 'SUBIR')}
                                    >
                                        <Feather name="arrow-up" size={14} color="#15803D" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.rankBtn}
                                        onPress={() => cambiarNivelRol(emp, 'BAJAR')}
                                    >
                                        <Feather name="arrow-down" size={14} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>

                                {/* 3. Permisos de Módulos (Interactivos) */}
                                <View
                                    style={{
                                        width: 340,
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 6,
                                        paddingRight: 10,
                                    }}
                                >
                                    {MODULOS_SISTEMA.map((mod) => {
                                        const activo = emp.permisos.includes(mod);
                                        return (
                                            <TouchableOpacity
                                                key={mod}
                                                style={[
                                                    styles.permChip,
                                                    activo ? styles.permChipActive : styles.permChipInactive,
                                                ]}
                                                onPress={() => togglePermisoModulo(emp, mod)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.permChipTxt,
                                                        activo ? { color: '#1E40AF' } : { color: '#94A3B8' },
                                                    ]}
                                                >
                                                    {activo ? '✓ ' : '+ '}
                                                    {mod}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* 4. Estado Activo / Suspendido */}
                                <View style={{ width: 100, alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.statePill,
                                            !emp.activoSistema && { backgroundColor: '#FEE2E2' },
                                        ]}
                                        onPress={() =>
                                            EnterpriseStore.actualizarEmpleado(emp.id, {
                                                activoSistema: !emp.activoSistema,
                                            })
                                        }
                                    >
                                        <Text
                                            style={{
                                                fontSize: 10,
                                                fontWeight: '800',
                                                color: emp.activoSistema ? '#15803D' : '#DC2626',
                                            }}
                                        >
                                            {emp.activoSistema ? 'ACTIVO' : 'SUSPENDIDO'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* 5. Botón Cambiar Usuario / Clave */}
                                <View style={{ width: 120, alignItems: 'flex-end' }}>
                                    <TouchableOpacity
                                        style={styles.credBtn}
                                        onPress={() => abrirModalCredenciales(emp)}
                                    >
                                        <Feather name="key" size={13} color="#FFFFFF" />
                                        <Text style={styles.credBtnText}>Clave / Rol</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* MODAL PARA CAMBIAR USUARIO, CONTRASEÑA O ROL */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Credenciales y Rol de Acceso</Text>
                                <Text style={styles.modalSub}>{empEditando?.nombre}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Nombre de Usuario (Login)</Text>
                        <TextInput
                            style={styles.input}
                            value={editUsername}
                            onChangeText={setEditUsername}
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>Nueva Contraseña</Text>
                        <TextInput
                            style={styles.input}
                            value={editPassword}
                            onChangeText={setEditPassword}
                            placeholder="Escribe la nueva contraseña..."
                        />

                        <Text style={styles.label}>Rol en el Sistema</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {JERARQUIA_ROLES.map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[
                                        styles.roleSelectPill,
                                        editRolSistema === r && styles.roleSelectPillActive,
                                    ]}
                                    onPress={() => setEditRolSistema(r)}
                                >
                                    <Text
                                        style={[
                                            styles.roleSelectTxt,
                                            editRolSistema === r && { color: '#FFFFFF' },
                                        ]}
                                    >
                                        {r}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnTxt}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={guardarCredenciales}>
                                <Text style={styles.saveBtnTxt}>Actualizar Credenciales</Text>
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
    content: { padding: 24, paddingBottom: 48, gap: 16 },
    headerRow: { marginBottom: 4 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 14,
        height: 44,
    },
    searchInput: { flex: 1, height: '100%', fontSize: 13, color: '#0F172A', outlineStyle: 'none' } as any,
    tableCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 6,
    },
    th: { fontSize: 10, fontWeight: '800', color: '#475569', letterSpacing: 0.4 },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    empName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    empUser: { fontSize: 12, color: '#3B38F6', fontWeight: '700', marginTop: 2 },
    roleBadge: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    roleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    rankBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    permChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    permChipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
    permChipInactive: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
    permChipTxt: { fontSize: 10, fontWeight: '800' },
    statePill: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    credBtn: {
        backgroundColor: '#3B38F6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    credBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 12, color: '#64748B' },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 42,
        paddingHorizontal: 12,
        fontSize: 13,
        marginBottom: 14,
        outlineStyle: 'none',
    } as any,
    roleSelectPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    roleSelectPillActive: { backgroundColor: '#0F172A' },
    roleSelectTxt: { fontSize: 11, fontWeight: '800', color: '#475569' },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    cancelBtnTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: {
        flex: 1.5,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#3B38F6',
        alignItems: 'center',
    },
    saveBtnTxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});