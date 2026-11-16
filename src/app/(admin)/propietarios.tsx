import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Linking,
    ActivityIndicator,
    useWindowDimensions,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ResiAlert, SessionStore, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PropietarioItem {
    id: string;
    idResidencial: number;
    idUsuario?: number;
    apto: string;
    torre: string;
    nombre: string;
    telefono: string;
    user: string;
    totalabonado: number;
    saldoPendiente: number;
    estado: 'verde' | 'rojo';
}

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

const extraerConfigBloques = (textoBloques?: string): { prefijo: string; listaBloques: string[] } => {
    const raw = String(textoBloques || 'Torre A & B').trim();
    const esBloque = raw.toLowerCase().includes('bloque');
    const esEdificio = raw.toLowerCase().includes('edificio');
    const prefijo = esBloque ? 'Bloque' : esEdificio ? 'Edificio' : 'Torre';

    const limpio = raw.replace(/\b(torres?|bloques?|edificios?)\b/gi, '');
    const partes = limpio
        .split(/[,&/]+|\s+y\s+/i)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

    if (partes.length === 0) {
        return { prefijo: 'Torre', listaBloques: ['Torre A', 'Torre B'] };
    }

    return {
        prefijo,
        listaBloques: partes.map((letra) => `${prefijo} ${letra}`),
    };
};

const determinarTorre = (aptoStr: string, prefijo: string = 'Torre'): string => {
    const limpio = String(aptoStr || '').trim().toUpperCase();
    const match = limpio.match(/^([A-Z]+)/);
    if (match && match[1]) {
        return `${prefijo} ${match[1]}`;
    }
    return `${prefijo} A`;
};

const fetchSafe = (url: string) =>
    fetch(url).catch((err) => {
        console.warn(`Error de red en ${url}:`, err.message);
        return { ok: false, json: async () => [] } as any;
    });

export default function PropietariosScreen() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isMobile = width < 640;
    const isVerySmall = width < 380;
    const { colors, darkMode } = useAppTheme();

    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState<string>('TODOS');
    const [prefijoUnidad, setPrefijoUnidad] = useState<string>('Torre');
    const [bloquesBD, setBloquesBD] = useState<string[]>(['Torre A', 'Torre B']);

    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [lista, setLista] = useState<PropietarioItem[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [tecladoAbierto, setTecladoAbierto] = useState(false);
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [formApto, setFormApto] = useState('');
    const [formNombre, setFormNombre] = useState('');
    const [formTelefono, setFormTelefono] = useState('');
    const [formTotalAbonado, setFormTotalAbonado] = useState('');
    const [formUser, setFormUser] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarDatosCruzados(currentSession?.idResidencial || idResidencial);
    }, [idResidencial]);

    // Detecta cuando el teclado se abre o se cierra para ajustar el espacio inferior y superior del modal
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setTecladoAbierto(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setTecladoAbierto(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const abrirWhatsAppPropietario = async (item: any) => {
        const telRaw = String(item.telefono || '').trim();

        if (!telRaw || telRaw.toUpperCase() === 'NULL' || telRaw === 'S/N' || telRaw === 'Sin teléfono') {
            ResiAlert.warning(
                'Sin Teléfono Registrado',
                `${item.nombre} (Apto ${item.apto}) aún no tiene un número de teléfono asignado en su perfil.`
            );
            return;
        }

        let numeroLimpio = telRaw.replace(/\D/g, '');

        if (numeroLimpio.length === 10 && /^(809|829|849)/.test(numeroLimpio)) {
            numeroLimpio = `1${numeroLimpio}`;
        }

        const nombreLimpio = String(item.nombre || '').replace(/\s+/g, ' ').trim();
        const textoSaludo = `Hola ${nombreLimpio}, le escribimos desde la administración del residencial.`;
        const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(textoSaludo)}`;

        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open(url, '_blank');
            } else {
                await Linking.openURL(url);
            }
        } catch (error) {
            ResiAlert.error('Error', 'No se pudo abrir la aplicación de WhatsApp.');
        }
    };

    const cargarDatosCruzados = async (resIdActual: number) => {
        setCargando(true);
        try {
            const [resCondo, resProps, resUsers] = await Promise.all([
                fetchSafe(`${API_BASE}/residencial?idResidencial=${resIdActual}`),
                fetchSafe(`${API_BASE}/propietarios?idResidencial=${resIdActual}`),
                fetchSafe(`${API_BASE}/usuarios?idResidencial=${resIdActual}`),
            ]);

            let prefijoDetectado = 'Torre';
            if (resCondo.ok) {
                const dataCondo = await resCondo.json();
                const condoObj = Array.isArray(dataCondo)
                    ? dataCondo.find((r: any) => Number(r.id) === Number(resIdActual)) || dataCondo[0]
                    : dataCondo;

                if (condoObj?.bloques) {
                    const config = extraerConfigBloques(condoObj.bloques);
                    prefijoDetectado = config.prefijo;
                    setPrefijoUnidad(config.prefijo);
                    setBloquesBD(config.listaBloques);
                }
            }

            if (resProps.ok) {
                const dataProps = await resProps.json();
                const dataUsers = resUsers.ok ? await resUsers.json() : [];

                const mapeados: PropietarioItem[] = dataProps.map((p: any) => {
                    const userAsociado = dataUsers.find((u: any) => u.id === p.idUsuario) || {};
                    const aptoVal = String(p.apto || p.numApto || 'A-1').trim();
                    const estadoBD = String(p.estado || '').trim().toLowerCase();
                    const balanceNum = Number(p.saldoPendiente ?? p.balance ?? 0);
                    const esRojo = estadoBD === 'rojo' || balanceNum < 0;

                    return {
                        id: String(p.id),
                        idResidencial: p.idResidencial || resIdActual,
                        idUsuario: p.idUsuario,
                        apto: aptoVal,
                        torre: determinarTorre(aptoVal, prefijoDetectado),
                        nombre: String(p.nombre || p.nombrePropietario || 'Sin nombre').replace(/\s+/g, ' ').trim(),
                        telefono: userAsociado.telefono || 'Sin teléfono',
                        user: userAsociado.username || 'Sin usuario asignado',
                        totalabonado: Number(p.totalAbonado ?? p.totalabonado ?? 0),
                        saldoPendiente: balanceNum,
                        estado: esRojo ? 'rojo' : 'verde',
                    };
                });
                setLista(mapeados);
            }
        } catch (error) {
            console.error('Error al cruzar datos:', error);
            ResiAlert.error('Error de Sincronización', 'No se pudo cargar el directorio de propietarios.');
        } finally {
            setCargando(false);
        }
    };

    const opcionesBloques = useMemo(() => {
        const setUnico = new Set<string>(bloquesBD);
        lista.forEach((p) => {
            if (p.torre) setUnico.add(p.torre);
        });
        return Array.from(setUnico);
    }, [bloquesBD, lista]);

    const abrirModalNuevo = () => {
        setEditandoId(null);
        setFormApto('');
        setFormNombre('');
        setFormTelefono('');
        setFormTotalAbonado('');
        setFormUser('');
        setFormPassword('');
        setMostrarPassword(false);
        setModalVisible(true);
    };

    const abrirModalEditar = (item: PropietarioItem) => {
        setEditandoId(item.id);
        setFormApto(item.apto);
        setFormNombre(item.nombre);
        setFormTelefono(item.telefono === 'Sin teléfono' ? '' : item.telefono);
        setFormTotalAbonado(String(item.totalabonado));
        setFormUser(item.user === 'Sin usuario asignado' ? '' : item.user);
        setFormPassword('');
        setMostrarPassword(false);
        setModalVisible(true);
    };

    const guardarPropietarioCompleto = async () => {
        if (!formApto.trim() || !formNombre.trim() || !formUser.trim()) {
            ResiAlert.warning(
                'Datos Obligatorios',
                'El número de Apartamento, Nombre del Titular y Usuario de acceso son obligatorios.'
            );
            return;
        }

        const torreAutomatica = determinarTorre(formApto, prefijoUnidad);
        const propietarioActual = lista.find((p) => p.id === editandoId);
        let idUsuarioVinculado = propietarioActual?.idUsuario;

        const payloadUsuario = {
            idResidencial,
            numApto: formApto.trim(),
            nombre: formNombre.trim(),
            username: formUser.trim(),
            telefono: formTelefono.trim() || '809-000-0000',
            rol: 'PROPIETARIO',
            passwordHash: formPassword || undefined,
        };

        setGuardando(true);
        try {
            if (editandoId && idUsuarioVinculado) {
                await fetch(`${API_BASE}/usuarios/${idUsuarioVinculado}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadUsuario),
                });
            } else {
                const resUsersCheck = await fetchSafe(`${API_BASE}/usuarios?idResidencial=${idResidencial}`);
                const listaUsuariosBD = resUsersCheck.ok ? await resUsersCheck.json() : [];
                const usuarioPrevio = listaUsuariosBD.find(
                    (u: any) =>
                        String(u.username || '').trim().toLowerCase() === formUser.trim().toLowerCase()
                );

                if (usuarioPrevio) {
                    const yaTienePropietario = lista.some(
                        (p) => Number(p.idUsuario) === Number(usuarioPrevio.id) && p.id !== editandoId
                    );
                    if (yaTienePropietario) {
                        setGuardando(false);
                        ResiAlert.error(
                            'Usuario En Uso',
                            `El usuario @${formUser.trim()} ya pertenece a otro propietario registrado.`
                        );
                        return;
                    }
                    idUsuarioVinculado = usuarioPrevio.id;
                    await fetch(`${API_BASE}/usuarios/${idUsuarioVinculado}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payloadUsuario),
                    });
                } else {
                    if (!formPassword) {
                        setGuardando(false);
                        ResiAlert.warning(
                            'Contraseña Requerida',
                            'Debes asignar una contraseña inicial para crear el nuevo usuario.'
                        );
                        return;
                    }

                    const resUser = await fetch(`${API_BASE}/usuarios`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payloadUsuario),
                    });

                    if (resUser.ok) {
                        const dataUser = await resUser.json();
                        idUsuarioVinculado = dataUser.id;
                    } else {
                        setGuardando(false);
                        ResiAlert.error(
                            'Usuario No Disponible',
                            'No se pudo crear el usuario en el servidor. Verifica que no esté duplicado.'
                        );
                        return;
                    }
                }
            }

            const montoAbonadoNum = parseFloat(formTotalAbonado) || propietarioActual?.totalabonado || 0;
            const payloadPropietario = {
                idResidencial,
                idUsuario: idUsuarioVinculado,
                apto: formApto.trim(),
                torre: torreAutomatica,
                nombre: formNombre.trim(),
                cuotaBase: 0,
                totalAbonado: montoAbonadoNum,
                balance: propietarioActual?.saldoPendiente ?? 0,
                estado: (propietarioActual?.estado || 'verde') as 'verde' | 'rojo',
            };

            const resPropSave = editandoId
                ? await fetch(`${API_BASE}/propietarios/${editandoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadPropietario),
                })
                : await fetch(`${API_BASE}/propietarios`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadPropietario),
                });

            if (resPropSave.ok) {
                setModalVisible(false);
                await cargarDatosCruzados(idResidencial);
                ResiAlert.success(
                    editandoId ? 'Propietario Actualizado' : 'Propietario Registrado',
                    `Los datos de ${formNombre.trim()} (Apto ${formApto.trim()}) y su usuario @${formUser.trim()} fueron guardados exitosamente.`
                );
            } else {
                ResiAlert.error(
                    'Error en Servidor al Guardar Propietario',
                    'El usuario se creó, pero hubo un problema al guardar la ficha del propietario.'
                );
            }
        } catch (error) {
            ResiAlert.error('Error de Conexión', 'Problema de red al conectar con el servidor.');
        } finally {
            setGuardando(false);
        }
    };

    const confirmarEliminarPropietario = (item: PropietarioItem) => {
        ResiAlert.confirm({
            titulo: `¿Eliminar Apto ${item.apto}?`,
            mensaje: `Se eliminará el registro de ${item.nombre} y su usuario (@${item.user}). Esta acción es irreversible.`,
            textoConfirmar: 'Sí, Eliminar',
            peligro: true,
            onConfirm: async () => {
                try {
                    await fetch(`${API_BASE}/propietarios/${item.id}`, { method: 'DELETE' });
                    if (item.idUsuario) {
                        await fetch(`${API_BASE}/usuarios/${item.idUsuario}`, { method: 'DELETE' });
                    }
                    setLista((prev) => prev.filter((p) => p.id !== item.id));
                    ResiAlert.toast(`Unidad ${item.apto} eliminada`, 'INFO');
                } catch (error) {
                    ResiAlert.error('Error al Eliminar', 'Fallo de comunicación con el servidor.');
                }
            },
        });
    };

    const filtrados = lista.filter((p) => {
        const matchText =
            p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.apto.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.telefono.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.user.toLowerCase().includes(busqueda.toLowerCase());

        if (!matchText) return false;
        if (filtro === 'TODOS') return true;
        if (filtro === 'MOROSOS') return p.estado === 'rojo';
        return p.torre.toUpperCase() === filtro.toUpperCase();
    });

    const botonesFiltro = [
        { key: 'TODOS', label: `Todos (${lista.length})` },
        ...opcionesBloques.map((bloque) => ({ key: bloque, label: bloque })),
        { key: 'MOROSOS', label: '● Morosos' },
    ];

    // Si el teclado está abierto, usamos solo 12px abajo (el teclado ya cubre la barra de Android).
    // Si el teclado está cerrado, usamos el margen de seguridad para no chocar con (||| O <).
    const modalBottomPadding = tecladoAbierto
        ? 12
        : Platform.OS === 'android'
            ? Math.max(insets.bottom + 20, 48)
            : Math.max(insets.bottom, 24);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.bg }]}
            contentContainerStyle={[styles.content, isMobile && { padding: 14, paddingBottom: 40 }]}
        >
            <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
                <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={[styles.pageTitle, { color: colors.text }, isMobile && { fontSize: 20 }]}>
                        Gestión de Propietarios
                    </Text>
                    <Text style={[styles.pageSub, { color: colors.subText }]}>
                        Directorio de unidades, usuarios de acceso y solvencia
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.newBtn, { backgroundColor: colors.primary }, isMobile && styles.newBtnMobile]}
                    onPress={abrirModalNuevo}
                >
                    <Feather name="user-plus" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>+ Nuevo Propietario</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.statsRow, isMobile && { gap: 8 }]}>
                <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }, isMobile && { padding: 12 }]}>
                    <Text style={[styles.statLabel, { color: colors.subText }]}>TOTAL</Text>
                    <Text style={[styles.statVal, { color: colors.text }, isMobile && { fontSize: 20 }]}>{lista.length}</Text>
                    <Text style={[styles.statSub, { color: colors.subText }]}>Unidades</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }, isMobile && { padding: 12 }]}>
                    <Text style={[styles.statLabel, { color: colors.success }]}>AL DÍA</Text>
                    <Text style={[styles.statVal, { color: colors.success }, isMobile && { fontSize: 20 }]}>
                        {lista.filter((x) => x.estado === 'verde').length}
                    </Text>
                    <Text style={[styles.statSub, { color: colors.subText }]}>Solventes</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }, isMobile && { padding: 12 }]}>
                    <Text style={[styles.statLabel, { color: colors.danger }]}>EN MORA</Text>
                    <Text style={[styles.statVal, { color: colors.danger }, isMobile && { fontSize: 20 }]}>
                        {lista.filter((x) => x.estado === 'rojo').length}
                    </Text>
                    <Text style={[styles.statSub, { color: colors.subText }]}>Pendientes</Text>
                </View>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="search" size={17} color={colors.subText} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Buscar por propietario, apto, teléfono o usuario..."
                    placeholderTextColor={colors.subText}
                    value={busqueda}
                    onChangeText={setBusqueda}
                />
                {busqueda.length > 0 && (
                    <TouchableOpacity onPress={() => setBusqueda('')}>
                        <Feather name="x-circle" size={17} color={colors.subText} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.filterPillsRow}>
                {botonesFiltro.map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.filterPill,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            filtro === f.key && { backgroundColor: colors.text, borderColor: colors.text },
                        ]}
                        onPress={() => setFiltro(f.key)}
                    >
                        <Text
                            style={[
                                styles.filterPillText,
                                { color: colors.subText },
                                filtro === f.key && { color: colors.bg },
                            ]}
                        >
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {cargando ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.subText, marginTop: 10, fontSize: 13 }}>Sincronizando datos...</Text>
                </View>
            ) : filtrados.length === 0 ? (
                <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                    <Text style={{ color: colors.subText, fontSize: 13, fontStyle: 'italic' }}>
                        No hay propietarios registrados en este filtro ({filtro}).
                    </Text>
                </View>
            ) : (
                <View style={{ gap: 14 }}>
                    {filtrados.map((item) => {
                        const esRojo = item.estado === 'rojo';
                        return (
                            <View
                                key={item.id}
                                style={[
                                    styles.ownerCard,
                                    { backgroundColor: colors.card, borderColor: colors.border },
                                    isMobile && { padding: 14 },
                                    esRojo && { borderColor: colors.danger, backgroundColor: colors.card },
                                ]}
                            >
                                <View style={styles.ownerTopRow}>
                                    <View style={[styles.aptoSquare, { backgroundColor: colors.primarySoft }, esRojo && { backgroundColor: colors.dangerBg }]}>
                                        <Text style={[styles.aptoSquareText, { color: colors.primary }, esRojo && { color: colors.danger }]}>
                                            {item.apto}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                            <Text style={[styles.ownerName, { color: colors.text }]}>{item.nombre}</Text>
                                            <View style={[styles.towerBadge, { backgroundColor: colors.inputBg }]}>
                                                <Text style={[styles.towerBadgeText, { color: colors.subText }]}>{item.torre}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.ownerMeta, { color: colors.subText }]}>Propietario Residente</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: esRojo ? colors.dangerBg : colors.successBg }]}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: esRojo ? colors.danger : colors.success }}>
                                            {esRojo ? '▲ En Mora' : '● Al Corriente'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={[styles.ownerFinancialBox, { backgroundColor: colors.inputBg }]}>
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={[styles.finLabel, { color: colors.subText }]}>Total Abonado</Text>
                                        <Text style={[styles.finValue, { color: colors.text }]}>RD$ {item.totalabonado.toLocaleString()}</Text>
                                    </View>
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={[styles.finLabel, { color: colors.subText }]}>Saldo Pendiente</Text>
                                        <Text style={[styles.finValue, { color: item.saldoPendiente >= 0 ? colors.success : colors.danger }]}>
                                            RD$ {item.saldoPendiente.toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={[styles.finLabel, { color: colors.subText }]}>Usuario</Text>
                                        <Text style={[styles.finValue, { color: colors.text }]} numberOfLines={1}>
                                            @{item.user}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.ownerActionsRow}>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                                        <TouchableOpacity
                                            style={[styles.chipBtn, { backgroundColor: colors.primarySoft }]}
                                            onPress={() =>
                                                ResiAlert.info(
                                                    `Contacto Apto ${item.apto}`,
                                                    `Teléfono registrado de ${item.nombre}: ${item.telefono}`
                                                )
                                            }
                                        >
                                            <Feather name="phone" size={13} color={colors.primary} />
                                            <Text style={[styles.chipBtnText, { color: colors.primary }]}>{item.telefono}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.chipBtn, { backgroundColor: colors.successBg }]}
                                            onPress={() => void abrirWhatsAppPropietario(item)}
                                        >
                                            <Feather name="message-circle" size={13} color={colors.success} />
                                            <Text style={[styles.chipBtnText, { color: colors.success }]}>WhatsApp</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.inputBg }]} onPress={() => abrirModalEditar(item)}>
                                            <Feather name="edit-2" size={16} color={colors.subText} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.dangerBg }]} onPress={() => confirmarEliminarPropietario(item)}>
                                            <Feather name="trash-2" size={16} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {modalVisible ? (
                <Modal
                    visible={true}
                    transparent
                    statusBarTranslucent
                    animationType={isMobile ? 'slide' : 'fade'}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        style={[
                            styles.modalBackdrop,
                            isMobile && styles.modalBackdropMobile,
                            {
                                backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(15, 23, 42, 0.55)',
                                // Tope superior seguro para que el encabezado jamás se salga por arriba al abrir el teclado
                                paddingTop: isMobile ? Math.max(insets.top + 14, 38) : 18,
                            },
                        ]}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View
                            style={[
                                styles.modalCard,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                isMobile && {
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    borderBottomLeftRadius: 0,
                                    borderBottomRightRadius: 0,
                                    paddingHorizontal: 18,
                                    paddingTop: tecladoAbierto ? 10 : 16,
                                    paddingBottom: modalBottomPadding,
                                },
                            ]}
                        >
                            {isMobile && !tecladoAbierto && (
                                <View style={[styles.mobileGrabber, { backgroundColor: colors.border }]} />
                            )}

                            <View
                                style={[
                                    styles.modalHeader,
                                    { borderBottomColor: colors.inputBg },
                                    tecladoAbierto && { paddingBottom: 8, marginBottom: 6 },
                                ]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primarySoft }]}>
                                        <Feather name={editandoId ? 'user-check' : 'user-plus'} size={18} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                                            {editandoId ? 'Editar Propietario' : 'Nuevo Propietario'}
                                        </Text>
                                        <Text style={[styles.modalSubtitle, { color: colors.subText }]}>
                                            {editandoId
                                                ? `Actualizando ficha de Apto ${formApto}`
                                                : 'Registra la unidad y su usuario de acceso'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.closeModalCircle, { backgroundColor: colors.inputBg }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Feather name="x" size={18} color={colors.subText} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.modalScrollBody}
                                contentContainerStyle={{ paddingVertical: 4 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={[styles.formRow, isVerySmall && { flexDirection: 'column', gap: 0 }]}>
                                    <View style={{ flex: isVerySmall ? 1 : 0.95 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>No. Apto (Ej: A-1)</Text>
                                        <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                            <Feather name="home" size={15} color={colors.subText} />
                                            <TextInput
                                                style={[styles.inputField, { color: colors.text }]}
                                                placeholder="Ej: A-1"
                                                placeholderTextColor={colors.subText}
                                                autoCapitalize="characters"
                                                value={formApto}
                                                onChangeText={setFormApto}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flex: isVerySmall ? 1 : 1.05 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>Total Abonado (RD$)</Text>
                                        <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                            <Feather name="dollar-sign" size={15} color={colors.success} />
                                            <TextInput
                                                style={[styles.inputField, { color: colors.text }]}
                                                placeholder="0.00"
                                                placeholderTextColor={colors.subText}
                                                keyboardType="numeric"
                                                value={formTotalAbonado}
                                                onChangeText={setFormTotalAbonado}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.text }]}>Nombre Completo del Titular</Text>
                                <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                    <Feather name="user" size={15} color={colors.subText} />
                                    <TextInput
                                        style={[styles.inputField, { color: colors.text }]}
                                        placeholder="Ej: María Fernanda Gómez"
                                        placeholderTextColor={colors.subText}
                                        value={formNombre}
                                        onChangeText={setFormNombre}
                                    />
                                </View>

                                <View style={[styles.formRow, isVerySmall && { flexDirection: 'column', gap: 0 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>Teléfono (WhatsApp)</Text>
                                        <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                            <Feather name="phone" size={15} color={colors.subText} />
                                            <TextInput
                                                style={[styles.inputField, { color: colors.text }]}
                                                placeholder="809-000-0000"
                                                placeholderTextColor={colors.subText}
                                                keyboardType="phone-pad"
                                                value={formTelefono}
                                                onChangeText={setFormTelefono}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>Usuario (App)</Text>
                                        <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                            <Feather name="at-sign" size={15} color={colors.primary} />
                                            <TextInput
                                                style={[styles.inputField, { color: colors.text }]}
                                                placeholder="ej: maria_a1"
                                                placeholderTextColor={colors.subText}
                                                autoCapitalize="none"
                                                value={formUser}
                                                onChangeText={setFormUser}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.text }]}>
                                    Contraseña de Acceso {editandoId ? '(Opcional)' : '*'}
                                </Text>
                                <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                    <Feather name="lock" size={15} color={colors.subText} />
                                    <TextInput
                                        style={[styles.inputField, { color: colors.text }]}
                                        placeholder={editandoId ? 'Vacío = mantener actual' : 'Escribe la contraseña inicial'}
                                        placeholderTextColor={colors.subText}
                                        secureTextEntry={!mostrarPassword}
                                        autoCapitalize="none"
                                        value={formPassword}
                                        onChangeText={setFormPassword}
                                    />
                                    <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
                                        <Feather name={mostrarPassword ? 'eye-off' : 'eye'} size={16} color={colors.subText} />
                                    </TouchableOpacity>
                                </View>

                                {formApto.trim().length > 0 && (
                                    <View style={[styles.towerHintPill, { backgroundColor: colors.primarySoft }]}>
                                        <Feather name="info" size={13} color={colors.primary} />
                                        <Text style={[styles.towerHintText, { color: colors.primary }]}>
                                            Se asignará automáticamente a{' '}
                                            <Text style={{ fontWeight: '800' }}>
                                                {determinarTorre(formApto, prefijoUnidad)}
                                            </Text>
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={[styles.modalFooter, { borderTopColor: colors.inputBg }]}>
                                <TouchableOpacity
                                    style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.saveModalBtn,
                                        { backgroundColor: colors.primary },
                                        guardando && { opacity: 0.7 },
                                    ]}
                                    disabled={guardando}
                                    onPress={() => void guardarPropietarioCompleto()}
                                >
                                    {guardando ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Feather name="check" size={16} color="#FFFFFF" />
                                            <Text style={styles.newBtnText}>
                                                {editandoId ? 'Guardar Cambios' : 'Guardar Datos'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
    headerRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
    pageTitle: { fontSize: 24, fontWeight: '800' },
    pageSub: { fontSize: 13, marginTop: 2 },
    newBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    newBtnMobile: { width: '100%', paddingVertical: 13 },
    newBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
    statBox: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1 },
    statLabel: { fontSize: 10, fontWeight: '800' },
    statVal: { fontSize: 24, fontWeight: '800', marginVertical: 2 },
    statSub: { fontSize: 11 },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, height: 46, paddingHorizontal: 14, marginBottom: 14 },
    searchInput: { flex: 1, height: '100%', fontSize: 14, paddingVertical: 0, includeFontPadding: false, outlineStyle: 'none' } as any,
    filterPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    filterPillText: { fontSize: 12, fontWeight: '700' },
    ownerCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
    ownerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    aptoSquare: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    aptoSquareText: { fontSize: 15, fontWeight: '800' },
    ownerName: { fontSize: 16, fontWeight: '800' },
    towerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    towerBadgeText: { fontSize: 11, fontWeight: '700' },
    ownerMeta: { fontSize: 12, marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    ownerFinancialBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderRadius: 12, padding: 12, marginBottom: 14 },
    finLabel: { fontSize: 11 },
    finValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
    ownerActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
    chipBtnText: { fontSize: 12, fontWeight: '700' },
    iconActionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
    modalBackdropMobile: { justifyContent: 'flex-end', paddingHorizontal: 0, paddingBottom: 0 },
    modalCard: { width: '100%', maxWidth: 460, maxHeight: '92%', flexShrink: 1, borderRadius: 22, padding: 22, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    mobileGrabber: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 10 },
    modalHeaderIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: '800' },
    modalSubtitle: { fontSize: 12, marginTop: 1 },
    closeModalCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    // flexShrink: 1 permite que el cuerpo haga scroll cuando el teclado reduce el alto disponible
    modalScrollBody: { flexGrow: 0, flexShrink: 1 },
    formRow: { flexDirection: 'row', gap: 10 },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, height: 42, marginBottom: 10 },
    inputField: { flex: 1, height: '100%', fontSize: 14, paddingVertical: 0, includeFontPadding: false, textAlignVertical: 'center', outlineStyle: 'none' } as any,
    towerHintPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 4 },
    towerHintText: { fontSize: 12 },
    modalFooter: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '700' },
    saveModalBtn: { flex: 1.4, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});