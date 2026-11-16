import React, { useState, useEffect } from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { EnterpriseStore } from '../(empresa)/dashboard';

export default function EmpleadoPortalScreen() {
    const router = useRouter();
    const [empleados, setEmpleados] = useState(EnterpriseStore.getEmpleados());
    const [reservas, setReservas] = useState(EnterpriseStore.getReservas());

    useEffect(() => {
        if (Platform.OS !== 'web') {
            // Lo pateamos inmediatamente de vuelta al login
            router.replace('/(auth)/login');
        }
        return EnterpriseStore.subscribe(() => {
            setEmpleados([...EnterpriseStore.getEmpleados()]);
            setReservas([...EnterpriseStore.getReservas()]);
        });
    }, []);

    if (Platform.OS !== 'web') return null;

    const miPerfil = empleados[0]; // Ejemplo con Carlos (Mecánico)
    const misOrdenes = reservas.filter((r) => r.idEmpleado === miPerfil?.id);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.topBar}>
                <View>
                    <Text style={styles.roleTag}>PORTAL DE TÉCNICOS Y EMPLEADOS • JR TECH</Text>
                    <Text style={styles.welcome}>Hola, {miPerfil?.nombre}</Text>
                </View>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(empresa)/dashboard')}>
                    <Text style={styles.backBtnTxt}>Volver a Master</Text>
                </TouchableOpacity>
            </View>

            {/* BILLETERA DEL TRABAJADOR */}
            <View style={styles.walletBanner}>
                <View>
                    <Text style={styles.wLabel}>MI BILLETERA DISPONIBLE HOY</Text>
                    <Text style={styles.wAmount}>RD$ {miPerfil?.saldoBilletera.toLocaleString()}</Text>
                    <Text style={styles.wSub}>Cuenta destino: {miPerfil?.banco} • {miPerfil?.cuentaBanco}</Text>
                </View>
                <TouchableOpacity
                    style={styles.cashOutBtn}
                    onPress={() => {
                        EnterpriseStore.actualizarEmpleado(miPerfil.id, { solicitoCobroHoy: true });
                        alert('Solicitud enviada a Administración. Recibirás tu transferencia al cierre del día.');
                    }}
                >
                    <Feather name="dollar-sign" size={16} color="#0F172A" />
                    <Text style={styles.cashOutTxt}>
                        {miPerfil?.solicitoCobroHoy ? '✓ Cobro Solicitado' : 'Cobrar al Final del Día'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Mis Reservas y Trabajos Asignados ({misOrdenes.length})</Text>
            {misOrdenes.map((ord) => (
                <View key={ord.id} style={styles.orderCard}>
                    <Text style={styles.ordCode}>{ord.codigo} • {ord.residencial}</Text>
                    <Text style={styles.ordTitle}>{ord.titulo}</Text>
                    <Text style={styles.ordDesc}>{ord.descripcion}</Text>
                    <Text style={styles.ordPay}>Pago por este trabajo: RD$ {ord.pagoManoObra.toLocaleString()}</Text>

                    {ord.estado !== 'VALIDADO_SUPERVISOR' && ord.estado !== 'PAGADO' ? (
                        <TouchableOpacity
                            style={styles.completeBtn}
                            onPress={() => EnterpriseStore.validarReserva(ord.id)}
                        >
                            <Feather name="map-pin" size={15} color="#FFFFFF" />
                            <Text style={styles.completeTxt}>Marcar Check-in GPS, Subir Foto y Terminar</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ color: '#15803D', fontWeight: '800', marginTop: 10 }}>
                            ✓ Trabajo completado y sumado a tu billetera
                        </Text>
                    )}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, gap: 18 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    roleTag: { fontSize: 10, fontWeight: '800', color: '#3B38F6' },
    welcome: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    backBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    backBtnTxt: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    walletBanner: { backgroundColor: '#0F172A', borderRadius: 18, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    wLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
    wAmount: { color: '#4ADE80', fontSize: 28, fontWeight: '800', marginVertical: 4 },
    wSub: { color: '#CBD5E1', fontSize: 12 },
    cashOutBtn: { backgroundColor: '#4ADE80', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cashOutTxt: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    orderCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
    ordCode: { fontSize: 12, fontWeight: '800', color: '#3B38F6' },
    ordTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
    ordDesc: { fontSize: 13, color: '#64748B', marginVertical: 4 },
    ordPay: { fontSize: 14, fontWeight: '800', color: '#15803D' },
    completeBtn: { marginTop: 12, backgroundColor: '#3B38F6', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    completeTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});