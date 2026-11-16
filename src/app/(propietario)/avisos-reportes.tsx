import React, { useEffect, useState } from 'react';
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
import { useAppTheme } from '../../hooks/useAppTheme';

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

const CATEGORIAS_AVERIA = ['Plomería / Agua', 'Electricidad / Luz', 'Gas GLP', 'Seguridad / Portón', 'Áreas Comunes'];

export default function AvisosReportesPropietario() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const miApto = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

    const { colors } = useAppTheme();

    const [cargando, setCargando] = useState(false);
    const [publicando, setPublicando] = useState(false);
    const [reportes, setReportes] = useState<Reporte[]>([]);
    const [filtroVista, setFiltroVista] = useState<'TODOS' | 'MIS_REPORTES' | 'AVISOS_ADMIN'>('TODOS');

    const [categoriaSel, setCategoriaSel] = useState('Plomería / Agua');
    const [asunto, setAsunto] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [editandoId, setEditandoId] = useState<number | null>(null);

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
        } finally {
            setCargando(false);
        }
    };

    const guardarMiReporte = async () => {
        if (!asunto.trim() || !descripcion.trim()) {
            ResiAlert.warning(
                'Campos Incompletos',
                'Por favor escribe el asunto y la descripción detallada de la avería antes de publicar.'
            );
            return;
        }

        const tituloConCategoria = asunto.startsWith('[') ? asunto.trim() : `[${categoriaSel}] ${asunto.trim()}`;

        const payload = {
            idResidencial,
            idUsuario: session?.id || null,
            apto: miApto,
            rolAutor: 'PROPIETARIO',
            titulo: tituloConCategoria,
            descripcion: descripcion.trim(),
            estado: 'Pendiente',
        };

        setPublicando(true);
        try {
            if (editandoId) {
                const actual = reportes.find((r) => r.id === editandoId);
                const res = await fetch(`${API_BASE}/reportes/${editandoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...actual,
                        titulo: tituloConCategoria,
                        descripcion: descripcion.trim(),
                    }),
                });

                if (res.ok) {
                    setEditandoId(null);
                    setAsunto('');
                    setDescripcion('');
                    await cargarReportes();
                    ResiAlert.success(
                        'Reporte Actualizado',
                        'Los cambios en tu reporte de avería fueron guardados exitosamente.'
                    );
                } else {
                    ResiAlert.error(
                        'No se pudo actualizar',
                        'El servidor no permitió guardar los cambios del reporte.'
                    );
                }
            } else {
                const res = await fetch(`${API_BASE}/reportes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    setAsunto('');
                    setDescripcion('');
                    await cargarReportes();
                    ResiAlert.success(
                        'Reporte Publicado',
                        'Tu reporte fue enviado a la administración y ya está visible en el muro comunitario.'
                    );
                } else {
                    ResiAlert.error(
                        'Error al Publicar',
                        'No se pudo registrar tu reporte en el servidor. Intenta nuevamente.'
                    );
                }
            }
        } catch (error) {
            console.error('Error guardando reporte:', error);
            ResiAlert.error(
                'Error de Conexión',
                'No pudimos conectar con el servidor de ResiFlow. Verifica tu internet.'
            );
        } finally {
            setPublicando(false);
        }
    };

    const confirmarEliminarReporte = (reporte: Reporte) => {
        ResiAlert.confirm({
            titulo: 'Eliminar Reporte',
            mensaje: `¿Estás seguro de que deseas eliminar tu reporte "${reporte.titulo}" del muro comunitario?`,
            textoConfirmar: 'Sí, Eliminar',
            peligro: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/reportes/${reporte.id}`, {
                        method: 'DELETE',
                    });
                    if (res.ok) {
                        await cargarReportes();
                        ResiAlert.success(
                            'Reporte Eliminado',
                            'Tu publicación ha sido retirada del muro comunitario.'
                        );
                    } else {
                        ResiAlert.error(
                            'No se pudo eliminar',
                            'El servidor no permitió eliminar este reporte.'
                        );
                    }
                } catch (error) {
                    console.error('Error eliminando reporte:', error);
                    ResiAlert.error(
                        'Error de Conexión',
                        'No se pudo conectar con el servidor para eliminar el reporte.'
                    );
                }
            },
        });
    };

    const reportesFiltrados = reportes.filter((r) => {
        if (filtroVista === 'MIS_REPORTES') {
            return String(r.apto || '').trim().toUpperCase() === miApto.toUpperCase();
        }
        if (filtroVista === 'AVISOS_ADMIN') {
            return String(r.rolAutor || '').toUpperCase() === 'ADMIN';
        }
        return true;
    });

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            {/* FORMULARIO DE NUEVA AVERÍA */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {editandoId ? 'Modificar Mi Reporte de Avería' : 'Reportar Avería o Incidencia al Administrador'}
                </Text>
                <Text style={[styles.cardSub, { color: colors.subText }]}>
                    Tu reporte llegará en tiempo real a la administración y podrás ver cuando cambie a "En Proceso" o "Resuelto".
                </Text>

                <Text style={[styles.label, { color: colors.text }]}>Categoría de la Incidencia</Text>
                <View style={styles.catRow}>
                    {CATEGORIAS_AVERIA.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.catPill,
                                { backgroundColor: colors.inputBg, borderColor: colors.border },
                                categoriaSel === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setCategoriaSel(cat)}
                        >
                            <Text
                                style={[
                                    styles.catPillTxt,
                                    { color: colors.subText },
                                    categoriaSel === cat && { color: '#FFFFFF' },
                                ]}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    placeholder="Asunto corto (ej. Lámpara quemada en escalera 2do piso)"
                    placeholderTextColor={colors.subText}
                    value={asunto}
                    onChangeText={setAsunto}
                />

                <TextInput
                    style={[
                        styles.input,
                        {
                            height: 84,
                            textAlignVertical: 'top',
                            paddingTop: 12,
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder="Describe la ubicación exacta o detalles para el técnico..."
                    placeholderTextColor={colors.subText}
                    multiline
                    value={descripcion}
                    onChangeText={setDescripcion}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {editandoId && (
                        <TouchableOpacity
                            style={[styles.cancelEditBtn, { backgroundColor: colors.inputBg }]}
                            onPress={() => {
                                setEditandoId(null);
                                setAsunto('');
                                setDescripcion('');
                            }}
                        >
                            <Text style={[styles.cancelEditTxt, { color: colors.subText }]}>Cancelar</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.submitBtn,
                            { flex: 1, backgroundColor: colors.primary },
                            publicando && { opacity: 0.7 },
                        ]}
                        disabled={publicando}
                        onPress={() => void guardarMiReporte()}
                    >
                        <Feather name="send" size={16} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>
                            {publicando ? 'Procesando...' : editandoId ? 'Guardar Cambios' : 'Publicar Reporte'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* FILTROS DEL MURO */}
            <View style={styles.filterRow}>
                {[
                    { id: 'TODOS', label: `Muro Comunitario (${reportes.length})` },
                    { id: 'MIS_REPORTES', label: `Mis Reportes (${miApto})` },
                    { id: 'AVISOS_ADMIN', label: '📢 Avisos de Administración' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.id}
                        style={[
                            styles.filterPill,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            filtroVista === f.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setFiltroVista(f.id as any)}
                    >
                        <Text
                            style={[
                                styles.filterPillTxt,
                                { color: colors.text },
                                filtroVista === f.id && { color: '#FFFFFF' },
                            ]}
                        >
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* LISTADO DE REPORTES Y AVISOS */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Seguimiento de Reportes y Avisos ({reportesFiltrados.length})
                </Text>
                {cargando ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 14 }} />
                ) : reportesFiltrados.length === 0 ? (
                    <Text style={{ color: colors.subText, marginTop: 12 }}>
                        No hay publicaciones en esta categoría.
                    </Text>
                ) : (
                    reportesFiltrados.map((r) => {
                        const esMio = String(r.apto || '').trim().toUpperCase() === miApto.toUpperCase();
                        const esAdmin = String(r.rolAutor || '').toUpperCase() === 'ADMIN';

                        const colorEstado =
                            r.estado === 'Resuelto'
                                ? colors.success
                                : r.estado === 'En Proceso'
                                    ? colors.warning
                                    : colors.danger;
                        const bgEstado =
                            r.estado === 'Resuelto'
                                ? colors.successBg
                                : r.estado === 'En Proceso'
                                    ? colors.warningBg
                                    : colors.dangerBg;

                        return (
                            <View key={r.id} style={[styles.reportItem, { borderBottomColor: colors.inputBg }]}>
                                <View style={styles.reportTopRow}>
                                    <Text style={[styles.reportMeta, { color: colors.subText }]}>
                                        {esAdmin ? '📢 ADMINISTRACIÓN' : `🏠 Apto ${r.apto}`} •{' '}
                                        {r.fechaReporte?.split('T')[0] || 'Reciente'}
                                    </Text>
                                    <View style={[styles.stateBadge, { backgroundColor: bgEstado }]}>
                                        <Text style={[styles.stateBadgeTxt, { color: colorEstado }]}>
                                            {r.estado}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={[styles.reportSubject, { color: colors.text }]}>{r.titulo}</Text>
                                <Text style={[styles.reportDesc, { color: colors.subText }]}>
                                    {r.descripcion}
                                </Text>

                                {esMio && !esAdmin && (
                                    <View style={styles.ownerActionsRow}>
                                        <TouchableOpacity
                                            style={[styles.btnEdit, { backgroundColor: colors.primary }]}
                                            onPress={() => {
                                                setEditandoId(r.id);
                                                setAsunto(r.titulo);
                                                setDescripcion(r.descripcion);
                                                ResiAlert.info(
                                                    'Modo Edición Activo',
                                                    'Modifica los datos en el formulario superior y presiona "Guardar Cambios".'
                                                );
                                            }}
                                        >
                                            <Feather name="edit-2" size={12} color="#FFFFFF" />
                                            <Text style={styles.btnText}>Modificar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btnDelete, { backgroundColor: colors.danger }]}
                                            onPress={() => confirmarEliminarReporte(r)}
                                        >
                                            <Feather name="trash-2" size={12} color="#FFFFFF" />
                                            <Text style={styles.btnText}>Eliminar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48, gap: 18 },
    card: { borderRadius: 18, padding: 22, borderWidth: 1 },
    cardTitle: { fontSize: 17, fontWeight: '800' },
    cardSub: { fontSize: 13, marginTop: 4, marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
    catPillTxt: { fontSize: 11, fontWeight: '800' },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, marginBottom: 12, outlineStyle: 'none' } as any,
    submitBtn: { paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    cancelEditBtn: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 },
    cancelEditTxt: { fontSize: 13, fontWeight: '700' },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    filterPillTxt: { fontSize: 12, fontWeight: '700' },
    reportItem: { paddingVertical: 14, borderBottomWidth: 1 },
    reportTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reportMeta: { fontSize: 11, fontWeight: '800' },
    stateBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    stateBadgeTxt: { fontSize: 10, fontWeight: '800' },
    reportSubject: { fontSize: 15, fontWeight: '800', marginVertical: 2 },
    reportDesc: { fontSize: 13, lineHeight: 19 },
    ownerActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    btnEdit: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
    btnDelete: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
    btnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});