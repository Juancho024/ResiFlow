import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {SessionStore, ResiAlert, UserSession} from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme'; // <-- INYECTADO

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

interface Reporte {
    id: number;
    idResidencial: number;
    idUsuario: number | null;
    apto: string;
    rolAutor: string;
    titulo: string;
    descripcion: string;
    estado: string;
    fechaReporte: string;
}

export default function AdminReportesScreen() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const { colors } = useAppTheme(); // <-- INYECTADO

    const [cargando, setCargando] = useState(false);
    const [reportes, setReportes] = useState<Reporte[]>([]);

    const [tituloAviso, setTituloAviso] = useState('');
    const [mensajeAviso, setMensajeAviso] = useState('');

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarReportes();
    }, []);

    const cargarReportes = async () => {
        setCargando(true);
        try {
            const res = await fetch(`${API_BASE}/reportes?idResidencial=${idResidencial}`);
            if (res.ok) {
                const data = await res.json();
                setReportes(data.slice().reverse());
            }
        } catch (error) {
            console.error('Error cargando reportes:', error);
            ResiAlert.error('Error de Red', 'No se pudieron cargar los tickets y comunicados.');
        } finally {
            setCargando(false);
        }
    };

    const publicarComunicado = async () => {
        if (!tituloAviso.trim() || !mensajeAviso.trim()) {
            ResiAlert.warning('Comunicado Incompleto', 'Por favor ingresa tanto el título como el mensaje detallado.');
            return;
        }

        const payload = {
            idResidencial,
            idUsuario: session?.id || null,
            apto: 'Administración',
            rolAutor: 'ADMIN',
            titulo: tituloAviso.trim(),
            descripcion: mensajeAviso.trim(),
            estado: 'Activo',
        };

        try {
            const res = await fetch(`${API_BASE}/reportes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setTituloAviso('');
                setMensajeAviso('');
                await cargarReportes();
                ResiAlert.success('Comunicado Publicado', 'El boletín oficial ya está visible en el muro.');
            } else {
                ResiAlert.error('No se pudo publicar', 'El servidor devolvió un error.');
            }
        } catch (error) {
            ResiAlert.error('Error de Conexión', 'No se pudo conectar con el servidor.');
        }
    };

    const cambiarEstadoTicket = async (reporte: Reporte) => {
        const nuevoEstado = reporte.estado === 'Resuelto' ? 'En Proceso' : 'Resuelto';

        try {
            const res = await fetch(`${API_BASE}/reportes/${reporte.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...reporte, estado: nuevoEstado }),
            });
            if (res.ok) {
                await cargarReportes();
                ResiAlert.toast(`Ticket #${reporte.id} (Apto ${reporte.apto}) marcado como ${nuevoEstado}`, 'SUCCESS');
            }
        } catch (error) {
            ResiAlert.error('Error al Actualizar', 'No se pudo cambiar el estado del ticket.');
        }
    };

    const eliminarComunicado = (reporte: Reporte) => {
        ResiAlert.confirm({
            titulo: '¿Eliminar Comunicado?',
            mensaje: `Se retirará el aviso "${reporte.titulo}" del muro comunitario.`,
            textoConfirmar: 'Sí, Eliminar',
            peligro: true,
            onConfirm: async () => {
                await fetch(`${API_BASE}/reportes/${reporte.id}`, { method: 'DELETE' });
                await cargarReportes();
                ResiAlert.toast('Comunicado eliminado del muro', 'INFO');
            },
        });
    };

    const comunicados = reportes.filter((r) => r.rolAutor === 'ADMIN');
    const tickets = reportes.filter((r) => r.rolAutor === 'PROPIETARIO');

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Centro de Averías y Comunicados Oficiales</Text>
            <Text style={[styles.pageSub, { color: colors.subText }]}>
                Atiende reportes de mantenimiento y envía boletines a la comunidad
            </Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <Feather name="volume-2" size={20} color={colors.primary} />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Enviar Nuevo Comunicado / Novedad</Text>
                </View>

                <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    placeholder="Título del aviso (ej. Fumigación Áreas Comunes...)"
                    placeholderTextColor={colors.subText}
                    value={tituloAviso}
                    onChangeText={setTituloAviso}
                />
                <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                    placeholder="Escribe el detalle del comunicado que verán todos los propietarios..."
                    placeholderTextColor={colors.subText}
                    multiline
                    value={mensajeAviso}
                    onChangeText={setMensajeAviso}
                />

                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => void publicarComunicado()}>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Publicar Comunicado Oficial</Text>
                </TouchableOpacity>
            </View>

            {cargando ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <>
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Tickets de Averías Reportadas ({tickets.length})</Text>
                        <View style={{ gap: 12, marginTop: 14 }}>
                            {tickets.length === 0 ? <Text style={{ color: colors.subText }}>No hay averías activas.</Text> : null}
                            {tickets.map((t) => (
                                <View key={t.id} style={[styles.ticketRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.ticketMeta, { color: colors.primary }]}>
                                            Ticket #{t.id} • Apto {t.apto} • Estado: {t.estado}
                                        </Text>
                                        <Text style={[styles.ticketTitle, { color: colors.text }]}>{t.titulo}</Text>
                                        <Text style={[styles.ticketTech, { color: colors.subText }]}>{t.descripcion}</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.statusBtn,
                                            { backgroundColor: t.estado === 'Resuelto' ? colors.successBg : colors.primarySoft },
                                        ]}
                                        onPress={() => void cambiarEstadoTicket(t)}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBtnText,
                                                { color: t.estado === 'Resuelto' ? colors.success : colors.primary },
                                            ]}
                                        >
                                            {t.estado === 'Resuelto' ? '✓ Solucionado' : 'Marcar Resuelto'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Comunicados Activos en el Muro ({comunicados.length})</Text>
                        <View style={{ gap: 12, marginTop: 14 }}>
                            {comunicados.map((c) => (
                                <View key={c.id} style={[styles.noticeItem, { borderBottomColor: colors.inputBg }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.ticketTitle, { color: colors.text }]}>{c.titulo}</Text>
                                        <Text style={[styles.noticeDesc, { color: colors.subText }]}>{c.descripcion}</Text>
                                        <Text style={[styles.noticeDate, { color: colors.subText }]}>{c.fechaReporte?.split('T')[0]}</Text>
                                    </View>
                                    <TouchableOpacity style={[styles.deleteNoticeBtn, { backgroundColor: colors.dangerBg }]} onPress={() => eliminarComunicado(c)}>
                                        <Feather name="trash-2" size={15} color={colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48, gap: 20 },
    pageTitle: { fontSize: 24, fontWeight: '800' },
    pageSub: { fontSize: 13, marginTop: -14 },
    card: { borderRadius: 18, padding: 22, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '800' },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, marginBottom: 12, outlineStyle: 'none' } as any,
    primaryBtn: { paddingVertical: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    ticketRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
    ticketMeta: { fontSize: 11, fontWeight: '800' },
    ticketTitle: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
    ticketTech: { fontSize: 12 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    statusBtnText: { fontSize: 12, fontWeight: '800' },
    noticeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    noticeDesc: { fontSize: 13, marginTop: 2 },
    noticeDate: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    deleteNoticeBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});