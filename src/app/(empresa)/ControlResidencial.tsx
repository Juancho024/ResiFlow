import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// URL del API Master corporativo (cámbiala cuando despliegues el nuevo backend seguro)
const API_MASTER = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

export default function ControlResidencial() {
    const router = useRouter();
    const [residenciales, setResidenciales] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    // Estados del modal para nuevo residencial
    const [modalVisible, setModalVisible] = useState(false);
    const [nombre, setNombre] = useState('');
    const [bloques, setBloques] = useState('');
    const [totalUnidades, setTotalUnidades] = useState('');

    useEffect(() => {
        cargarResidenciales();
    }, []);

    const cargarResidenciales = async () => {
        setCargando(true);
        try {
            const res = await fetch(`${API_MASTER}/residencial`);
            if (res.ok) {
                const data = await res.json();
                // Si la API devuelve un objeto único o lista, lo adaptamos
                setResidenciales(Array.isArray(data) ? data : [data]);
            }
        } catch (error) {
            console.error("Error cargando residenciales master:", error);
        } finally {
            setCargando(false);
        }
    };

    const crearResidencial = async () => {
        if (!nombre.trim()) return;

        const payload = {
            nombre,
            bloques: bloques || 'Bloques Generales',
            totalUnidades: parseInt(totalUnidades) || 8,
            estado: 'Operativo'
        };

        try {
            const res = await fetch(`${API_MASTER}/residencial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setModalVisible(false);
                setNombre('');
                setBloques('');
                setTotalUnidades('');
                cargarResidenciales();
                alert('Residencial registrado exitosamente en la red.');
            }
        } catch (error) {
            console.error("Error creando residencial:", error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.pageTitle}>Directorio de Residenciales</Text>
                    <Text style={styles.pageSub}>Administración centralizada de condominios clientes</Text>
                </View>
                <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>Registrar Nuevo Residencial</Text>
                </TouchableOpacity>
            </View>

            {cargando ? (
                <ActivityIndicator size="large" color="#3B38F6" style={{ marginTop: 40 }} />
            ) : (
                <View style={styles.grid}>
                    {residenciales.map((item, idx) => (
                        <View key={item.id || idx} style={styles.card}>
                            <View style={styles.cardTop}>
                                <View style={styles.iconBox}>
                                    <MaterialCommunityIcons name="domain" size={24} color="#3B38F6" />
                                </View>
                                <View style={styles.badgeOp}>
                                    <Text style={styles.badgeOpText}>{item.estado || 'Operativo'}</Text>
                                </View>
                            </View>

                            <Text style={styles.cardName}>{item.nombre}</Text>
                            <Text style={styles.cardMeta}>{item.bloques}</Text>
                            <Text style={styles.cardUnits}>{item.totalUnidades} Unidades Habitacionales</Text>

                            <TouchableOpacity
                                style={styles.auditBtn}
                                onPress={() => {
                                    // MODO DIOS: Cambia el contexto al residencial seleccionado
                                    alert(`Entrando en modo auditoría para: ${item.nombre}`);
                                    router.replace('/(admin)/dashboard');
                                }}
                            >
                                <Feather name="external-link" size={15} color="#3B38F6" />
                                <Text style={styles.auditBtnText}>Modo Auditoría / Panel Admin</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* MODAL CREAR RESIDENCIAL */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Nuevo Residencial</Text>

                        <Text style={styles.label}>Nombre del Residencial</Text>
                        <TextInput style={styles.input} placeholder="Ej: Residencial Las Acacias II" value={nombre} onChangeText={setNombre} />

                        <Text style={styles.label}>Bloques / Torres</Text>
                        <TextInput style={styles.input} placeholder="Ej: Torre A & B" value={bloques} onChangeText={setBloques} />

                        <Text style={styles.label}>Total de Unidades (Apartamentos)</Text>
                        <TextInput style={styles.input} placeholder="Ej: 16" keyboardType="numeric" value={totalUnidades} onChangeText={setTotalUnidades} />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={crearResidencial}>
                                <Text style={styles.saveBtnText}>Guardar Residencial</Text>
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
    content: { padding: 28, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    newBtn: { backgroundColor: '#3B38F6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
    newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    card: { width: 320, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    iconBox: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    badgeOp: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    badgeOpText: { color: '#15803D', fontSize: 11, fontWeight: '800' },
    cardName: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    cardMeta: { fontSize: 12, color: '#64748B', marginBottom: 2 },
    cardUnits: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 18 },
    auditBtn: { backgroundColor: '#EEF2FF', paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    auditBtnText: { color: '#3B38F6', fontSize: 12, fontWeight: '700' },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, height: 44, paddingHorizontal: 14, fontSize: 14, marginBottom: 14 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: { flex: 1.5, paddingVertical: 13, borderRadius: 10, backgroundColor: '#3B38F6', alignItems: 'center' },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' }
});