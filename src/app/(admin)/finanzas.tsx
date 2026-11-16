import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Modal,
    TextInput,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SessionStore, ResiAlert, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';
const ITEMS_POR_PAGINA = 6;

interface Propietario {
    id: number;
    apto: string;
    nombre: string;
    totalAbonado?: number;
    balance: number;
}

interface Pago {
    id: number;
    idResidencial?: number;
    idPropietario: number;
    fechaPago: string;
    monto: number;
    metodoPago: string;
    concepto: string;
    comprobanteImg?: string | null;
    estado: 'PENDIENTE_VALIDACION' | 'APROBADO' | 'RECHAZADO';
}

const desdeBase64Puro = (b64: string | null | undefined): string | null => {
    if (!b64) return null;
    if (b64.startsWith('data:image') || b64.startsWith('http')) return b64;
    return `data:image/jpeg;base64,${b64}`;
};

const aBase64Puro = (uri: string | null): string | null => {
    if (!uri) return null;
    const partes = uri.split(',');
    return partes.length > 1 ? partes[1] : uri;
};

export default function FinanzasScreen() {
    const insets = useSafeAreaInsets();
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const { colors, darkMode } = useAppTheme();

    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [propietarios, setPropietarios] = useState<Propietario[]>([]);
    const [filtroEstado, setFiltroEstado] = useState<'PENDIENTES' | 'HISTORIAL'>('PENDIENTES');

    // Estados de Búsqueda y Paginación
    const [busqueda, setBusqueda] = useState('');
    const [paginaActual, setPaginaActual] = useState(1);

    const [modalVisible, setModalVisible] = useState(false);
    const [pagoEditando, setPagoEditando] = useState<Pago | null>(null);
    const [formPropId, setFormPropId] = useState<number | null>(null);
    const [formMonto, setFormMonto] = useState('');
    const [formMetodo, setFormMetodo] = useState<string>('EFECTIVO');
    const [formConcepto, setFormConcepto] = useState('');
    const [formEstado, setFormEstado] = useState<'PENDIENTE_VALIDACION' | 'APROBADO' | 'RECHAZADO'>('APROBADO');
    const [formVoucher, setFormVoucher] = useState<string | null>(null);
    const [dropdownAbierto, setDropdownAbierto] = useState(false);

    const [visorAbierto, setVisorAbierto] = useState(false);
    const [pagoEnVisor, setPagoEnVisor] = useState<Pago | null>(null);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarDatos();
    }, []);

    // Reiniciar a la página 1 cuando cambie de pestaña o escriba en el buscador
    useEffect(() => {
        setPaginaActual(1);
    }, [filtroEstado, busqueda]);

    const cargarDatos = async () => {
        setCargando(true);
        try {
            const [resProps, resPagos] = await Promise.all([
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`),
                fetch(`${API_BASE}/pagos/vouchers?idResidencial=${idResidencial}`),
            ]);

            if (resProps.ok) {
                const dataProps = await resProps.json();
                setPropietarios(dataProps);
            }

            if (resPagos.ok) {
                const dataPagos = await resPagos.json();

                const pagosNormalizados = dataPagos.map((p: any) => {
                    let estadoNorm = String(p.estado || '').toUpperCase().trim();
                    if (estadoNorm === 'APROBADO' || estadoNorm === 'VERDE') estadoNorm = 'APROBADO';
                    else if (estadoNorm === 'RECHAZADO' || estadoNorm === 'ROJO') estadoNorm = 'RECHAZADO';
                    else estadoNorm = 'PENDIENTE_VALIDACION';

                    let metodoNorm = String(p.metodoPago || '').toUpperCase().trim();
                    if (metodoNorm.includes('EFECTIVO')) metodoNorm = 'EFECTIVO';
                    else metodoNorm = 'TRANSFERENCIA';

                    return {
                        ...p,
                        estado: estadoNorm,
                        metodoPago: metodoNorm,
                    };
                });

                setPagos(pagosNormalizados.slice().reverse());
            }
        } catch (error) {
            console.error('Error cargando finanzas:', error);
            ResiAlert.error('Error de Red', 'No se pudieron sincronizar las transacciones financieras.');
        } finally {
            setCargando(false);
        }
    };

    const mapaPropietarios = useMemo(() => {
        const map = new Map<number, Propietario>();
        propietarios.forEach((p) => map.set(p.id, p));
        return map;
    }, [propietarios]);

    const getPropInfo = (idProp: number) => {
        const p = mapaPropietarios.get(idProp);
        return p ? `Apto ${p.apto} • ${String(p.nombre || '').replace(/\s+/g, ' ').trim()}` : 'Propietario Desconocido';
    };

    const getPropBalanceInfo = (idProp: number) => {
        const p = mapaPropietarios.get(idProp);
        if (!p) return null;
        const abonado = Number(p.totalAbonado ?? 0);
        const bal = Number(p.balance ?? 0);
        return `Abonado: RD$ ${abonado.toLocaleString()} | Balance: RD$ ${bal.toLocaleString()}`;
    };

    const abrirModalNuevoManual = () => {
        setPagoEditando(null);
        setFormPropId(null);
        setFormMonto('');
        setFormMetodo('EFECTIVO');
        setFormConcepto('');
        setFormEstado('APROBADO');
        setFormVoucher(null);
        setDropdownAbierto(false);
        setModalVisible(true);
    };

    const abrirModalEditarPago = (pago: Pago) => {
        setPagoEditando(pago);
        setFormPropId(pago.idPropietario);
        setFormMonto(String(pago.monto));
        setFormMetodo(pago.metodoPago);
        setFormConcepto(pago.concepto || '');
        setFormEstado(pago.estado);
        setFormVoucher(desdeBase64Puro(pago.comprobanteImg));
        setDropdownAbierto(false);
        setModalVisible(true);
    };

    const abrirVisorPantallaGrande = (pago: Pago) => {
        setPagoEnVisor(pago);
        setVisorAbierto(true);
    };

    const ejecutarCambioEstado = async (pagoActual: Pago, nuevoEstado: 'APROBADO' | 'RECHAZADO') => {
        try {
            const response = await fetch(`${API_BASE}/pagos/${pagoActual.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...pagoActual, estado: nuevoEstado }),
            });
            if (response.ok) {
                await cargarDatos();
                if (nuevoEstado === 'APROBADO') {
                    ResiAlert.success(
                        'Pago Aprobado y Acreditado',
                        `El pago de ${getPropInfo(pagoActual.idPropietario)} por RD$ ${pagoActual.monto.toLocaleString()} fue inyectado a su balance exitosamente.`
                    );
                } else {
                    ResiAlert.info(
                        'Pago Rechazado',
                        `El comprobante #${pagoActual.id} fue marcado como rechazado y no afectará el balance de la unidad.`
                    );
                }
            } else {
                ResiAlert.error('Error en Validación', 'El servidor no pudo actualizar el estado del pago.');
            }
        } catch (error) {
            console.error('Error validando pago:', error);
            ResiAlert.error('Error de Conexión', 'No se pudo conectar con el servidor al validar el pago.');
        }
    };

    const cambiarEstadoPago = (id: number, nuevoEstado: 'APROBADO' | 'RECHAZADO') => {
        const pagoActual = pagos.find((p) => p.id === id);
        if (!pagoActual) return;

        if (nuevoEstado === 'RECHAZADO') {
            ResiAlert.confirm({
                titulo: '¿Rechazar Comprobante?',
                mensaje: `Estás por rechazar el pago de ${getPropInfo(pagoActual.idPropietario)} por RD$ ${pagoActual.monto.toLocaleString()}.`,
                textoConfirmar: 'Sí, Rechazar',
                peligro: true,
                onConfirm: () => void ejecutarCambioEstado(pagoActual, 'RECHAZADO'),
            });
        } else {
            void ejecutarCambioEstado(pagoActual, 'APROBADO');
        }
    };

    const guardarPagoModal = async () => {
        if (!formPropId || !formMonto || !formConcepto.trim()) {
            ResiAlert.warning(
                'Campos Obligatorios',
                'Por favor selecciona el propietario, ingresa el monto en RD$ y escribe el concepto del pago.'
            );
            return;
        }

        const montoNumerico = parseFloat(formMonto);
        if (isNaN(montoNumerico) || montoNumerico <= 0) {
            ResiAlert.warning('Monto Inválido', 'Ingresa un monto numérico mayor a RD$ 0.00.');
            return;
        }

        setGuardando(true);

        const payload = {
            idResidencial: idResidencial,
            idPropietario: formPropId,
            monto: montoNumerico,
            metodoPago: formMetodo,
            concepto: formConcepto.trim(),
            comprobanteImg: aBase64Puro(formVoucher),
            estado: formEstado,
            fechaPago: pagoEditando ? pagoEditando.fechaPago : new Date().toISOString(),
        };

        try {
            const esEdicion = pagoEditando !== null;
            const url = esEdicion ? `${API_BASE}/pagos/${pagoEditando.id}` : `${API_BASE}/pagos`;
            const metodoHttp = esEdicion ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: metodoHttp,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setModalVisible(false);
                await cargarDatos();
                ResiAlert.success(
                    esEdicion ? 'Transacción Modificada' : 'Pago Manual Aplicado',
                    esEdicion
                        ? `El pago #${pagoEditando.id} fue actualizado y el balance de ${getPropInfo(formPropId)} se recalculó automáticamente.`
                        : `Se registró el pago de RD$ ${montoNumerico.toLocaleString()} para ${getPropInfo(formPropId)} y su balance fue actualizado.`
                );
            } else {
                ResiAlert.error(
                    'Error en Base de Datos',
                    'No se pudo guardar el pago en el servidor.'
                );
            }
        } catch (error) {
            console.error('Error guardando pago:', error);
            ResiAlert.error('Error de Conexión', 'No se pudo conectar con el servidor al guardar el pago.');
        } finally {
            setGuardando(false);
        }
    };

    const seleccionarImagenVoucher = async () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: any) => {
                const file = e.target?.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setFormVoucher(reader.result as string);
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                ResiAlert.warning('Permiso Requerido', 'Necesitamos acceso a tus fotos para adjuntar el comprobante.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets[0].base64) {
                setFormVoucher(`data:image/jpeg;base64,${result.assets[0].base64}`);
                ResiAlert.toast('Comprobante adjuntado con éxito', 'SUCCESS');
            }
        }
    };

    const pagosPendientes = useMemo(
        () => pagos.filter((p) => p.estado === 'PENDIENTE_VALIDACION'),
        [pagos]
    );
    const historialPagos = useMemo(
        () => pagos.filter((p) => p.estado !== 'PENDIENTE_VALIDACION'),
        [pagos]
    );

    const listaFiltrada = useMemo(() => {
        const base = filtroEstado === 'PENDIENTES' ? pagosPendientes : historialPagos;
        const q = busqueda.trim().toLowerCase();
        if (!q) return base;

        return base.filter((p) => {
            const propInfo = getPropInfo(p.idPropietario).toLowerCase();
            const concepto = String(p.concepto || '').toLowerCase();
            const fecha = String(p.fechaPago || '').toLowerCase();
            const montoStr = String(p.monto || '');
            return (
                propInfo.includes(q) ||
                concepto.includes(q) ||
                fecha.includes(q) ||
                montoStr.includes(q)
            );
        });
    }, [filtroEstado, pagosPendientes, historialPagos, busqueda, mapaPropietarios]);

    const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / ITEMS_POR_PAGINA));
    const paginaSegura = Math.min(paginaActual, totalPaginas);

    const pagosPaginados = useMemo(() => {
        const inicio = (paginaSegura - 1) * ITEMS_POR_PAGINA;
        return listaFiltrada.slice(inicio, inicio + ITEMS_POR_PAGINA);
    }, [listaFiltrada, paginaSegura]);

    const bottomSafeModal = Platform.OS === 'android' ? Math.max(insets.bottom + 20, 44) : Math.max(insets.bottom, 20);

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.pageTitle, { color: colors.text }]}>Validación Financiera</Text>
                    <Text style={[styles.pageSub, { color: colors.subText }]}>
                        Aprueba pagos, visualiza vouchers en pantalla completa o edita transacciones
                    </Text>
                </View>
                <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={abrirModalNuevoManual}>
                    <Feather name="plus-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.newBtnText}>Registrar Pago Manual</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[
                        styles.tabBtn,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        filtroEstado === 'PENDIENTES' && { backgroundColor: colors.text, borderColor: colors.text },
                    ]}
                    onPress={() => setFiltroEstado('PENDIENTES')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: colors.subText },
                            filtroEstado === 'PENDIENTES' && { color: colors.bg },
                        ]}
                    >
                        Por Validar ({pagosPendientes.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabBtn,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        filtroEstado === 'HISTORIAL' && { backgroundColor: colors.text, borderColor: colors.text },
                    ]}
                    onPress={() => setFiltroEstado('HISTORIAL')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: colors.subText },
                            filtroEstado === 'HISTORIAL' && { color: colors.bg },
                        ]}
                    >
                        Historial Verificado ({historialPagos.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* BUSCADOR RÁPIDO PARA FILTRAR VOUCHERS */}
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="search" size={16} color={colors.subText} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Filtrar pagos por apartamento, propietario, fecha o concepto..."
                    placeholderTextColor={colors.subText}
                    value={busqueda}
                    onChangeText={setBusqueda}
                />
                {busqueda.length > 0 && (
                    <TouchableOpacity onPress={() => setBusqueda('')}>
                        <Feather name="x-circle" size={16} color={colors.subText} />
                    </TouchableOpacity>
                )}
            </View>

            {/* BARRA SUPERIOR DE PAGINACIÓN */}
            {listaFiltrada.length > ITEMS_POR_PAGINA && (
                <View style={[styles.paginationBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.paginationInfo, { color: colors.subText }]}>
                        Mostrando {(paginaSegura - 1) * ITEMS_POR_PAGINA + 1} -{' '}
                        {Math.min(paginaSegura * ITEMS_POR_PAGINA, listaFiltrada.length)} de {listaFiltrada.length}
                    </Text>
                    <View style={styles.paginationBtns}>
                        <TouchableOpacity
                            style={[
                                styles.pageBtn,
                                { backgroundColor: colors.inputBg, borderColor: colors.border },
                                paginaSegura <= 1 && { opacity: 0.4 },
                            ]}
                            disabled={paginaSegura <= 1}
                            onPress={() => setPaginaActual((p) => Math.max(1, p - 1))}
                        >
                            <Feather name="chevron-left" size={16} color={colors.text} />
                            <Text style={[styles.pageBtnText, { color: colors.text }]}>Anterior</Text>
                        </TouchableOpacity>

                        <View style={[styles.pageBadge, { backgroundColor: colors.primarySoft }]}>
                            <Text style={[styles.pageBadgeText, { color: colors.primary }]}>
                                Pág. {paginaSegura} / {totalPaginas}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.pageBtn,
                                { backgroundColor: colors.inputBg, borderColor: colors.border },
                                paginaSegura >= totalPaginas && { opacity: 0.4 },
                            ]}
                            disabled={paginaSegura >= totalPaginas}
                            onPress={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                        >
                            <Text style={[styles.pageBtnText, { color: colors.text }]}>Siguiente</Text>
                            <Feather name="chevron-right" size={16} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {cargando ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <View style={{ gap: 14 }}>
                    {pagosPaginados.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.subText }]}>No hay pagos en esta categoría.</Text>
                    ) : (
                        pagosPaginados.map((p) => {
                            const tieneVoucher = Boolean(p.comprobanteImg);
                            // En PENDIENTES mostramos la miniatura directamente; en HISTORIAL la abrimos bajo demanda para máxima fluidez
                            const mostrarMiniaturaDirecta = filtroEstado === 'PENDIENTES' && tieneVoucher;
                            const uriImagen = mostrarMiniaturaDirecta ? desdeBase64Puro(p.comprobanteImg) : null;
                            const balanceInfo = getPropBalanceInfo(p.idPropietario);

                            return (
                                <View key={p.id} style={[styles.pagoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={[styles.pagoHeader, { borderBottomColor: colors.inputBg }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.pagoApto, { color: colors.text }]}>{getPropInfo(p.idPropietario)}</Text>
                                            <Text style={[styles.pagoFecha, { color: colors.subText }]}>
                                                Fecha: {p.fechaPago?.split('T')[0] || 'Sin fecha'}
                                                {balanceInfo ? `  •  ${balanceInfo}` : ''}
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.badge,
                                                p.estado === 'APROBADO'
                                                    ? { backgroundColor: colors.successBg }
                                                    : p.estado === 'RECHAZADO'
                                                        ? { backgroundColor: colors.dangerBg }
                                                        : { backgroundColor: colors.warningBg },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.badgeText,
                                                    p.estado === 'APROBADO'
                                                        ? { color: colors.success }
                                                        : p.estado === 'RECHAZADO'
                                                            ? { color: colors.danger }
                                                            : { color: colors.warning },
                                                ]}
                                            >
                                                {p.estado.replace('_', ' ')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.pagoDetalles}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.lbl, { color: colors.subText }]}>Monto</Text>
                                            <Text style={[styles.valAmount, { color: colors.success }]}>RD$ {p.monto.toLocaleString()}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.lbl, { color: colors.subText }]}>Método</Text>
                                            <Text style={[styles.valText, { color: colors.text }]}>{p.metodoPago}</Text>
                                        </View>
                                        <View style={{ flex: 1.5 }}>
                                            <Text style={[styles.lbl, { color: colors.subText }]}>Concepto</Text>
                                            <Text style={[styles.valText, { color: colors.text }]}>{p.concepto}</Text>
                                        </View>
                                    </View>

                                    {tieneVoucher && (
                                        <View style={[styles.voucherCont, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                            <View style={styles.voucherHeaderRow}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Feather name="image" size={14} color={colors.primary} />
                                                    <Text style={[styles.lbl, { color: colors.text, marginBottom: 0 }]}>
                                                        Comprobante Adjunto
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={[styles.zoomBtn, { backgroundColor: colors.primarySoft }]}
                                                    onPress={() => abrirVisorPantallaGrande(p)}
                                                >
                                                    <Feather name="maximize-2" size={13} color={colors.primary} />
                                                    <Text style={[styles.zoomBtnText, { color: colors.primary }]}>
                                                        Ver Voucher Completo
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>

                                            {uriImagen ? (
                                                <TouchableOpacity activeOpacity={0.85} onPress={() => abrirVisorPantallaGrande(p)}>
                                                    <Image
                                                        source={{ uri: uriImagen }}
                                                        style={styles.voucherThumb}
                                                        resizeMode="cover"
                                                    />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    )}

                                    <View style={[styles.accionesRow, { borderTopColor: colors.inputBg }]}>
                                        {p.estado === 'PENDIENTE_VALIDACION' && (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                                                    onPress={() => cambiarEstadoPago(p.id, 'APROBADO')}
                                                >
                                                    <Feather name="check" size={16} color="#FFFFFF" />
                                                    <Text style={styles.actionBtnText}>Aprobar e Inyectar</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: colors.danger, flex: 0.45 }]}
                                                    onPress={() => cambiarEstadoPago(p.id, 'RECHAZADO')}
                                                >
                                                    <Feather name="x" size={16} color="#FFFFFF" />
                                                    <Text style={styles.actionBtnText}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.editPagoBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}
                                            onPress={() => abrirModalEditarPago(p)}
                                        >
                                            <Feather name="edit-3" size={15} color={colors.primary} />
                                            <Text style={[styles.editPagoBtnText, { color: colors.primary }]}>Modificar Pago</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}

                    {/* CONTROLES DE PAGINACIÓN INFERIORES */}
                    {listaFiltrada.length > ITEMS_POR_PAGINA && (
                        <View style={[styles.paginationBar, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 6 }]}>
                            <TouchableOpacity
                                style={[
                                    styles.pageBtn,
                                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    paginaSegura <= 1 && { opacity: 0.4 },
                                ]}
                                disabled={paginaSegura <= 1}
                                onPress={() => setPaginaActual((p) => Math.max(1, p - 1))}
                            >
                                <Feather name="chevron-left" size={16} color={colors.text} />
                                <Text style={[styles.pageBtnText, { color: colors.text }]}>Página Anterior</Text>
                            </TouchableOpacity>

                            <Text style={[styles.paginationInfo, { color: colors.text, fontWeight: '800' }]}>
                                {paginaSegura} de {totalPaginas}
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.pageBtn,
                                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    paginaSegura >= totalPaginas && { opacity: 0.4 },
                                ]}
                                disabled={paginaSegura >= totalPaginas}
                                onPress={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                            >
                                <Text style={[styles.pageBtnText, { color: colors.text }]}>Página Siguiente</Text>
                                <Feather name="chevron-right" size={16} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {modalVisible && (
                <Modal
                    visible={true}
                    transparent
                    statusBarTranslucent
                    animationType="fade"
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View style={[styles.modalBackdrop, { paddingBottom: bottomSafeModal }]}>
                        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <View style={styles.modalHeaderRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                                            {pagoEditando ? `Modificar Pago #${pagoEditando.id}` : 'Registrar Pago Manual'}
                                        </Text>
                                        <Text style={[styles.modalSub, { color: colors.subText }]}>
                                            {pagoEditando
                                                ? 'Cualquier ajuste recalculará automáticamente el balance.'
                                                : 'Este pago se aprobará y sumará automáticamente al balance.'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                                        <Feather name="x" size={20} color={colors.subText} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.label, { color: colors.text }]}>Propietario / Unidad</Text>
                                <View style={{ zIndex: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.dropdownBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                                        onPress={() => setDropdownAbierto(!dropdownAbierto)}
                                    >
                                        <Text style={{ color: formPropId ? colors.text : colors.subText, fontWeight: '600' }}>
                                            {formPropId ? getPropInfo(formPropId) : 'Seleccione una unidad...'}
                                        </Text>
                                        <Ionicons name="caret-down" size={16} color={colors.subText} />
                                    </TouchableOpacity>
                                    {dropdownAbierto && (
                                        <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
                                                {propietarios.map((prop) => (
                                                    <TouchableOpacity
                                                        key={prop.id}
                                                        style={[styles.dropdownItem, { borderBottomColor: colors.inputBg }]}
                                                        onPress={() => {
                                                            setFormPropId(prop.id);
                                                            setDropdownAbierto(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                                                            Apto {prop.apto} - {prop.nombre}
                                                        </Text>
                                                        <Text style={[styles.dropdownItemSub, { color: colors.subText }]}>
                                                            Balance actual: RD$ {Number(prop.balance ?? 0).toLocaleString()}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>Monto (RD$)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                            keyboardType="numeric"
                                            value={formMonto}
                                            onChangeText={setFormMonto}
                                            placeholderTextColor={colors.subText}
                                            placeholder="Ej: 1500"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.text }]}>Método</Text>
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            <TouchableOpacity
                                                style={[styles.metodoBtn, { backgroundColor: colors.inputBg }, formMetodo === 'EFECTIVO' && { backgroundColor: colors.text }]}
                                                onPress={() => setFormMetodo('EFECTIVO')}
                                            >
                                                <Text style={[styles.metodoText, { color: colors.subText }, formMetodo === 'EFECTIVO' && { color: colors.bg }]}>
                                                    Efectivo
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.metodoBtn, { backgroundColor: colors.inputBg }, formMetodo === 'TRANSFERENCIA' && { backgroundColor: colors.text }]}
                                                onPress={() => setFormMetodo('TRANSFERENCIA')}
                                            >
                                                <Text style={[styles.metodoText, { color: colors.subText }, formMetodo === 'TRANSFERENCIA' && { color: colors.bg }]}>
                                                    Transf.
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.text }]}>Estado de Validación</Text>
                                <View style={styles.estadoSelectorRow}>
                                    {(
                                        [
                                            { id: 'APROBADO', label: '✓ Aprobado' },
                                            { id: 'PENDIENTE_VALIDACION', label: '⏳ Pendiente' },
                                            { id: 'RECHAZADO', label: '✕ Rechazado' },
                                        ] as const
                                    ).map((est) => (
                                        <TouchableOpacity
                                            key={est.id}
                                            style={[styles.estadoOptionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, formEstado === est.id && { backgroundColor: colors.text, borderColor: colors.text }]}
                                            onPress={() => setFormEstado(est.id)}
                                        >
                                            <Text style={[styles.estadoOptionText, { color: colors.subText }, formEstado === est.id && { color: colors.bg }]}>
                                                {est.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.label, { color: colors.text }]}>Concepto del pago</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    value={formConcepto}
                                    onChangeText={setFormConcepto}
                                    placeholderTextColor={colors.subText}
                                    placeholder="Ej: Pago cuota octubre y atrasos"
                                />

                                <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]} onPress={seleccionarImagenVoucher}>
                                    <Feather name="image" size={18} color={colors.primary} />
                                    <Text style={[styles.uploadBtnText, { color: colors.primary }]}>
                                        {formVoucher ? 'Cambiar Imagen del Comprobante ✓' : 'Adjuntar Recibo / Voucher (Opcional)'}
                                    </Text>
                                </TouchableOpacity>

                                {formVoucher && (
                                    <View style={[styles.previewBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                        <Image
                                            source={{ uri: formVoucher }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="contain"
                                        />
                                        <TouchableOpacity style={[styles.removeVoucherX, { backgroundColor: colors.danger }]} onPress={() => setFormVoucher(null)}>
                                            <Feather name="x" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]} onPress={() => setModalVisible(false)}>
                                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }, guardando && { opacity: 0.7 }]} disabled={guardando} onPress={() => void guardarPagoModal()}>
                                        <Text style={styles.saveBtnText}>
                                            {guardando ? 'Guardando...' : pagoEditando ? 'Guardar Cambios' : 'Aplicar al Balance'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}

            {visorAbierto && (
                <Modal
                    visible={true}
                    transparent
                    statusBarTranslucent
                    animationType="fade"
                    onRequestClose={() => setVisorAbierto(false)}
                >
                    <View
                        style={[
                            styles.lightboxBackdrop,
                            {
                                backgroundColor: darkMode ? 'rgba(0,0,0,0.92)' : 'rgba(15, 23, 42, 0.94)',
                                paddingBottom: bottomSafeModal,
                            },
                        ]}
                    >
                        <View style={styles.lightboxTopBar}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.lightboxTitle}>
                                    {pagoEnVisor ? getPropInfo(pagoEnVisor.idPropietario) : 'Comprobante'}
                                </Text>
                                <Text style={styles.lightboxSub}>
                                    {pagoEnVisor ? `RD$ ${pagoEnVisor.monto.toLocaleString()} • ${pagoEnVisor.metodoPago} • ${pagoEnVisor.concepto}` : ''}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setVisorAbierto(false)}>
                                <Feather name="x" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.lightboxImageWrapper}>
                            {pagoEnVisor?.comprobanteImg ? (
                                <Image
                                    source={{ uri: desdeBase64Puro(pagoEnVisor.comprobanteImg)! }}
                                    style={styles.lightboxFullImage}
                                    resizeMode="contain"
                                />
                            ) : null}
                        </View>

                        {pagoEnVisor && (
                            <View style={styles.lightboxBottomBar}>
                                <TouchableOpacity
                                    style={[styles.lightboxEditBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => {
                                        const target = pagoEnVisor;
                                        setVisorAbierto(false);
                                        abrirModalEditarPago(target);
                                    }}
                                >
                                    <Feather name="edit-3" size={16} color="#FFFFFF" />
                                    <Text style={styles.lightboxEditBtnText}>Modificar este Pago</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    pageTitle: { fontSize: 24, fontWeight: '800' },
    pageSub: { fontSize: 13 },
    newBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
    newBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    tabText: { fontSize: 13, fontWeight: '700' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, height: 44, paddingHorizontal: 14, marginBottom: 14 },
    searchInput: { flex: 1, height: '100%', fontSize: 13, paddingVertical: 0, includeFontPadding: false, outlineStyle: 'none' } as any,
    paginationBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
    paginationInfo: { fontSize: 12, fontWeight: '600' },
    paginationBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    pageBtnText: { fontSize: 12, fontWeight: '700' },
    pageBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    pageBadgeText: { fontSize: 12, fontWeight: '800' },
    emptyText: { textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
    pagoCard: { borderRadius: 16, padding: 18, borderWidth: 1 },
    pagoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, paddingBottom: 12, marginBottom: 12, gap: 10 },
    pagoApto: { fontSize: 16, fontWeight: '800' },
    pagoFecha: { fontSize: 12, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    pagoDetalles: { flexDirection: 'row', gap: 12 },
    lbl: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    valAmount: { fontSize: 16, fontWeight: '800' },
    valText: { fontSize: 13, fontWeight: '600' },
    voucherCont: { marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
    voucherHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    zoomBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    zoomBtnText: { fontSize: 11, fontWeight: '800' },
    voucherThumb: { width: '100%', height: 140, borderRadius: 8, marginTop: 10 },
    accionesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
    actionBtn: { flex: 1, minWidth: 150, paddingVertical: 11, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    editPagoBtn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    editPagoBtnText: { fontSize: 12, fontWeight: '800' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 20, padding: 24 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalSub: { fontSize: 12, marginTop: 2 },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    dropdownBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 14 },
    dropdownList: { borderWidth: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopWidth: 0, overflow: 'hidden' },
    dropdownItem: { padding: 12, borderBottomWidth: 1 },
    dropdownItemText: { fontSize: 13, fontWeight: '700' },
    dropdownItemSub: { fontSize: 11, marginTop: 2 },
    input: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 14, paddingVertical: 0, includeFontPadding: false, fontSize: 14, marginBottom: 14, outlineStyle: 'none' } as any,
    metodoBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    metodoText: { fontSize: 12, fontWeight: '700' },
    estadoSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    estadoOptionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    estadoOptionText: { fontSize: 11, fontWeight: '800' },
    uploadBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    uploadBtnText: { fontSize: 13, fontWeight: '700' },
    previewBox: { position: 'relative', width: '100%', height: 125, marginTop: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
    removeVoucherX: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
    cancelBtnText: { fontSize: 13, fontWeight: '700' },
    saveBtn: { flex: 1.5, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    lightboxBackdrop: { flex: 1, justifyContent: 'space-between', padding: 24, paddingTop: 48 },
    lightboxTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
    lightboxTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    lightboxSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
    lightboxCloseBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    lightboxImageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 16 },
    lightboxFullImage: { width: '100%', height: '100%', borderRadius: 12 },
    lightboxBottomBar: { alignItems: 'center', paddingTop: 10 },
    lightboxEditBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    lightboxEditBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});