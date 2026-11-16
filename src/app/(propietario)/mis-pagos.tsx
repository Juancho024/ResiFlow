import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Platform,
    Image,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SessionStore, ResiAlert, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

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

const normalizarTexto = (txt: string | undefined | null): string =>
    String(txt || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

export default function MisPagosScreen() {
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const miAptoSesion = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

    const { colors, darkMode } = useAppTheme();

    const [cargando, setCargando] = useState(true);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);
    const [miAptoReal, setMiAptoReal] = useState(miAptoSesion);
    const [idPropietarioBD, setIdPropietarioBD] = useState<number | null>(null);
    const [abonadoPerfilBD, setAbonadoPerfilBD] = useState<number>(0);
    const [gasPagadoTablaBD, setGasPagadoTablaBD] = useState<number>(0);
    const [pagosBD, setPagosBD] = useState<any[]>([]);

    const [filtro, setFiltro] = useState<'TODOS' | 'MANTENIMIENTO' | 'GAS'>('TODOS');
    const [busquedaMes, setBusquedaMes] = useState('');

    const [voucherEnVisor, setVoucherEnVisor] = useState<any | null>(null);

    const [modalEditarVisible, setModalEditarVisible] = useState(false);
    const [pagoEditando, setPagoEditando] = useState<any | null>(null);
    const [editMetodo, setEditMetodo] = useState<'TRANSFERENCIA' | 'EFECTIVO'>('TRANSFERENCIA');
    const [editMonto, setEditMonto] = useState('');
    const [editConcepto, setEditConcepto] = useState('');
    const [editVoucherUri, setEditVoucherUri] = useState<string | null>(null);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarMiHistorial();
    }, []);

    const cargarMiHistorial = async () => {
        setCargando(true);
        try {
            const [resProp, resPagos, resGas] = await Promise.all([
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/pagos?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-gas?idResidencial=${idResidencial}`).catch(() => null),
            ]);

            const props = resProp?.ok ? await resProp.json() : [];
            const allPagos = resPagos?.ok ? await resPagos.json() : [];
            const allGas = resGas?.ok ? await resGas.json() : [];

            const aptoBuscadoNorm = normalizarTexto(miAptoSesion);
            const nombreBuscado = String(session?.nombre || '').trim().toLowerCase();

            const miInfo = props.find((p: any) => {
                const aptoPropNorm = normalizarTexto(p.apto || p.numApto);
                const nombreProp = String(p.nombre || p.nombrePropietario || '').trim().toLowerCase();
                return (
                    (session?.id && p.idUsuario === session.id) ||
                    (aptoBuscadoNorm && aptoPropNorm === aptoBuscadoNorm) ||
                    (nombreBuscado &&
                        (nombreProp === nombreBuscado ||
                            nombreProp.includes(nombreBuscado) ||
                            nombreBuscado.includes(nombreProp)))
                );
            });

            const aptoOficial = miInfo ? miInfo.apto || miInfo.numApto || miAptoSesion : miAptoSesion;
            const aptoOficialNorm = normalizarTexto(aptoOficial);

            setMiAptoReal(aptoOficial);

            if (miInfo) {
                setIdPropietarioBD(miInfo.id);
                setAbonadoPerfilBD(parseFloat(String(miInfo.totalAbonado ?? miInfo.totalabonado ?? 0)) || 0);
            }

            const misPagos = allPagos.filter((p: any) => {
                const coincideId = miInfo && Number(p.idPropietario) === Number(miInfo.id);
                const conceptoNorm = normalizarTexto(p.concepto);
                const coincideAptoEnConcepto =
                    aptoOficialNorm && conceptoNorm.includes(`APTO${aptoOficialNorm}`);
                return coincideId || coincideAptoEnConcepto;
            });

            setPagosBD(misPagos.slice().reverse());

            const sumaTablaGas = allGas
                .filter(
                    (rg: any) =>
                        normalizarTexto(rg.apto) === aptoOficialNorm &&
                        String(rg.estado || '').toUpperCase() === 'PAGADO'
                )
                .reduce(
                    (acc: number, rg: any) =>
                        acc + (parseFloat(rg.totalPagar ?? rg.totalapagar ?? 0) || 0),
                    0
                );

            setGasPagadoTablaBD(sumaTablaGas);
        } catch (error) {
            console.error('Error trayendo historial:', error);
        } finally {
            setCargando(false);
        }
    };

    const abrirModalEditar = (pago: any) => {
        setPagoEditando(pago);
        const esEfectivo = String(pago.metodoPago || '').toUpperCase().includes('EFECTIVO');
        setEditMetodo(esEfectivo ? 'EFECTIVO' : 'TRANSFERENCIA');
        setEditMonto(String(pago.monto ?? ''));
        setEditConcepto(String(pago.concepto ?? ''));
        setEditVoucherUri(desdeBase64Puro(pago.comprobanteImg));
        setModalEditarVisible(true);
    };

    const seleccionarImagenEdicion = async () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: any) => {
                const file = e.target?.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setEditVoucherUri(reader.result as string);
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        } else {
            // VERSIÓN MÓVIL NATIVA CON EXPO-IMAGE-PICKER
            try {
                const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    ResiAlert.warning(
                        'Permiso Requerido',
                        'Necesitamos acceso a tu galería para actualizar la imagen del comprobante.'
                    );
                    return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.7,
                    base64: true,
                });

                if (!result.canceled && result.assets && result.assets[0].base64) {
                    setEditVoucherUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
                    ResiAlert.toast('Comprobante adjuntado con éxito', 'SUCCESS');
                }
            } catch (err) {
                console.error('Error seleccionando imagen:', err);
                ResiAlert.error('Error', 'No se pudo abrir la galería de fotos.');
            }
        }
    };

    const guardarEdicionPago = async () => {
        if (!pagoEditando) return;
        const montoNum = parseFloat(editMonto) || 0;
        if (montoNum <= 0 || !editConcepto.trim()) {
            ResiAlert.warning(
                'Datos Incompletos',
                'Por favor ingresa un monto mayor a RD$ 0.00 y escribe el concepto detallado del pago.'
            );
            return;
        }

        setGuardandoEdicion(true);
        const payload = {
            id: pagoEditando.id,
            idResidencial: pagoEditando.idResidencial || idResidencial,
            idPropietario: pagoEditando.idPropietario || idPropietarioBD,
            monto: montoNum,
            metodoPago: editMetodo,
            concepto: editConcepto.trim(),
            comprobanteImg: aBase64Puro(editVoucherUri),
            estado: 'PENDIENTE_VALIDACION',
            fechaPago: pagoEditando.fechaPago || new Date().toISOString(),
        };

        try {
            const res = await fetch(`${API_BASE}/pagos/${pagoEditando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setModalEditarVisible(false);
                await cargarMiHistorial();
                ResiAlert.success(
                    'Pago Enviado a Validación',
                    'Los cambios fueron guardados y el recibo se envió nuevamente a validación por el administrador.'
                );
            } else {
                ResiAlert.error(
                    'No se pudo actualizar',
                    'El servidor rechazó la modificación del pago. Intenta nuevamente.'
                );
            }
        } catch (error) {
            console.error('Error actualizando pago:', error);
            ResiAlert.error(
                'Error de Conexión',
                'No pudimos conectar con el servidor al actualizar tu pago.'
            );
        } finally {
            setGuardandoEdicion(false);
        }
    };

    const eliminarMiPago = (pago: any) => {
        ResiAlert.confirm({
            titulo: 'Eliminar Recibo de Pago',
            mensaje: `¿Estás seguro de que deseas eliminar el recibo #${pago.id} por RD$ ${Number(pago.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}?`,
            textoConfirmar: 'Sí, Eliminar',
            peligro: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/pagos/${pago.id}`, {
                        method: 'DELETE',
                    });
                    if (res.ok) {
                        await cargarMiHistorial();
                        ResiAlert.success(
                            'Recibo Eliminado',
                            `El recibo #${pago.id} fue eliminado correctamente de tu historial.`
                        );
                    } else {
                        ResiAlert.error(
                            'No se pudo eliminar',
                            'El servidor no permitió eliminar este registro de pago.'
                        );
                    }
                } catch (error) {
                    console.error('Error eliminando pago:', error);
                    ResiAlert.error(
                        'Error de Conexión',
                        'No se pudo conectar con el servidor al intentar eliminar el pago.'
                    );
                }
            },
        });
    };

    const filtrados = pagosBD.filter((v) => {
        const esGas = String(v.concepto || '').toLowerCase().includes('gas');
        const cumpleCuenta = filtro === 'TODOS' ? true : filtro === 'MANTENIMIENTO' ? !esGas : esGas;
        const texto = busquedaMes.toLowerCase();
        const fechaTxt = v.fechaPago?.split('T')[0] || '';
        const cumpleBusqueda =
            !texto ||
            String(v.concepto || '').toLowerCase().includes(texto) ||
            String(v.metodoPago || '').toLowerCase().includes(texto) ||
            fechaTxt.includes(texto);

        return cumpleCuenta && cumpleBusqueda;
    });

    const sumaPagosMantAprobados = pagosBD
        .filter((v) => !String(v.concepto || '').toLowerCase().includes('gas') && v.estado === 'APROBADO')
        .reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0);
    const totalAprobadoMant = Math.max(abonadoPerfilBD, sumaPagosMantAprobados);

    const sumaPagosGasAprobados = pagosBD
        .filter((v) => String(v.concepto || '').toLowerCase().includes('gas') && v.estado === 'APROBADO')
        .reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0);
    const totalAprobadoGas = Math.max(gasPagadoTablaBD, sumaPagosGasAprobados);

    const descargarPDFConVouchers = async () => {
        if (filtrados.length === 0) {
            ResiAlert.warning('Sin Recibos para Exportar', 'No tienes pagos registrados en el filtro actual.');
            return;
        }

        const tarjetasHTML = filtrados
            .map((v) => {
                const uriImg = desdeBase64Puro(v.comprobanteImg);
                return `
                <div class="voucher-item">
                  <div class="v-header">
                    <b>Recibo #${v.id} | Fecha: ${v.fechaPago?.split('T')[0] || 'Reciente'} | RD$ ${Number(v.monto).toFixed(2)}</b><br/>
                    <span style="color: ${v.estado === 'APROBADO' ? '#16A34A' : '#DC2626'}; font-weight: bold;">
                        Estado: ${String(v.estado || '').replace('_', ' ')}
                    </span>
                  </div>
                  <div class="bhd-card">
                    <div class="black-tag">${v.concepto || 'Pago de Unidad'}</div>
                    <div class="bhd-inner">
                      <div style="font-size:18px; font-weight:bold;">RD$ ${Number(v.monto).toFixed(2)}</div>
                      <div style="font-size:11px; margin-top:6px;">Método: ${v.metodoPago}</div>
                      ${uriImg ? `<img src="${uriImg}" style="max-width:100%; max-height:180px; margin-top:8px; border-radius:6px;" />` : ''}
                    </div>
                  </div>
                </div>`;
            })
            .join('');

        const construirHTMLPagos = (incluirScriptPrint: boolean) => `
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Estado de Cuenta - Apto ${miAptoReal}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #0F172A; }
                .grid { display: flex; flex-wrap: wrap; gap: 16px; }
                .voucher-item { width: 46%; border: 1px solid #ccc; padding: 10px; border-radius: 8px; page-break-inside: avoid; }
                .bhd-card { background: #4ADE80; padding: 10px; border-radius: 8px; margin-top: 6px; }
                .black-tag { background: #1E293B; color: #fff; padding: 6px; text-align: center; font-weight: bold; border-radius: 4px; }
                .bhd-inner { background: #fff; padding: 10px; margin-top: 6px; text-align: center; border-radius: 6px; }
              </style>
            </head>
            <body>
              <h2>Historial de Pagos (Apto ${miAptoReal} - ${session?.nombre || 'Propietario'})</h2>
              <p><b>Mantenimiento Aprobado:</b> RD$ ${totalAprobadoMant.toFixed(2)} &nbsp;|&nbsp; <b>Gas GLP Pagado:</b> RD$ ${totalAprobadoGas.toFixed(2)}</p>
              <div class="grid">${tarjetasHTML}</div>
              ${incluirScriptPrint ? '<script>window.onload = function() { window.print(); };</script>' : ''}
            </body>
          </html>
        `;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const Win = window.open('', '_blank');
            if (Win) {
                Win.document.write(construirHTMLPagos(true));
                Win.document.close();
            }
        } else {
            // VERSIÓN MÓVIL NATIVA CON EXPO-PRINT Y EXPO-SHARING
            try {
                const { uri } = await Print.printToFileAsync({
                    html: construirHTMLPagos(false),
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Estado de Cuenta - Apto ${miAptoReal}`,
                    });
                } else {
                    ResiAlert.success('PDF Generado', `Guardado en: ${uri}`);
                }
            } catch (err) {
                console.error('Error exportando PDF de pagos:', err);
                ResiAlert.error('Error', 'No se pudo generar el PDF de tus recibos en el celular.');
            }
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <View
                style={[
                    styles.headerBanner,
                    {
                        backgroundColor: darkMode ? colors.card : '#2D3E4E',
                        borderColor: colors.border,
                        borderWidth: darkMode ? 1 : 0,
                    },
                ]}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: darkMode ? colors.text : '#FFFFFF' }]}>
                        HISTORIAL DE PAGOS REPORTADOS (Apto {miAptoReal})
                    </Text>
                    <Text style={[styles.bannerMeta, { color: darkMode ? colors.subText : '#CBD5E1' }]}>
                        Propietario: {session?.nombre} • Mantenimiento Aprobado: RD${' '}
                        {totalAprobadoMant.toLocaleString('en-US', { minimumFractionDigits: 2 })} • Gas Pagado: RD${' '}
                        {totalAprobadoGas.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.pdfBtn, { backgroundColor: colors.primary }]}
                    onPress={() => void descargarPDFConVouchers()}
                >
                    <Feather name="download" size={18} color="#FFFFFF" />
                    <Text style={styles.pdfBtnText}>Descargar PDF ({filtrados.length})</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputsGrid}>
                <View style={styles.inputCol}>
                    <Text style={[styles.label, { color: colors.text }]}>
                        Buscar pago por Concepto, Método o Fecha
                    </Text>
                    <View
                        style={[
                            styles.searchBarContainer,
                            { backgroundColor: colors.card, borderColor: colors.border },
                        ]}
                    >
                        <Feather name="search" size={16} color={colors.subText} />
                        <TextInput
                            style={[styles.searchInputDirect, { color: colors.text }]}
                            placeholder="Ej: Octubre, Gas, Transferencia, 2026..."
                            value={busquedaMes}
                            onChangeText={setBusquedaMes}
                            placeholderTextColor={colors.subText}
                        />
                        {busquedaMes ? (
                            <TouchableOpacity onPress={() => setBusquedaMes('')}>
                                <Feather name="x-circle" size={18} color={colors.subText} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </View>

            <View style={styles.filterRow}>
                {[
                    { id: 'TODOS', label: `Todos (${pagosBD.length})` },
                    { id: 'MANTENIMIENTO', label: 'Mantenimiento' },
                    { id: 'GAS', label: 'Gas GLP' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.id}
                        style={[
                            styles.filterPill,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            filtro === f.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setFiltro(f.id as any)}
                    >
                        <Text
                            style={[
                                styles.filterPillText,
                                { color: colors.text },
                                filtro === f.id && { color: '#FFFFFF' },
                            ]}
                        >
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {cargando ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <View style={styles.vouchersGrid}>
                    {filtrados.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Feather name="inbox" size={28} color={colors.subText} />
                            <Text style={{ color: colors.subText, fontWeight: '600', marginTop: 8 }}>
                                No hay recibos individuales reportados en este filtro para el Apto {miAptoReal}.
                            </Text>
                        </View>
                    ) : null}

                    {filtrados.map((v) => {
                        const uriImg = desdeBase64Puro(v.comprobanteImg);
                        return (
                            <View
                                key={v.id}
                                style={[
                                    styles.voucherWrapper,
                                    { backgroundColor: colors.card, borderColor: colors.border },
                                ]}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={[styles.vMeta, { color: colors.text }]}>
                                        Recibo #{v.id} • {v.fechaPago?.split('T')[0]}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.vApproved,
                                            { color: colors.success },
                                            v.estado === 'PENDIENTE_VALIDACION' && { color: colors.warning },
                                            v.estado === 'RECHAZADO' && { color: colors.danger },
                                        ]}
                                    >
                                        {v.estado.replace('_', ' ')}
                                    </Text>
                                </View>
                                <Text style={[styles.vMeta, { color: colors.text, marginBottom: 8 }]}>
                                    Monto: RD$ {Number(v.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })} •{' '}
                                    {v.metodoPago}
                                </Text>

                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => uriImg && setVoucherEnVisor(v)}
                                    style={[
                                        styles.bhdOuter,
                                        { backgroundColor: darkMode ? '#166534' : '#4ADE80' },
                                        v.estado === 'RECHAZADO' && {
                                            backgroundColor: darkMode ? colors.dangerBg : '#FCA5A5',
                                        },
                                        v.estado === 'PENDIENTE_VALIDACION' && {
                                            backgroundColor: darkMode ? colors.warningBg : '#FCD34D',
                                        },
                                    ]}
                                >
                                    <View style={styles.blackOverlayTag}>
                                        <Text style={styles.blackOverlayText}>{v.concepto}</Text>
                                    </View>
                                    {uriImg ? (
                                        <View style={[styles.bhdWhiteBox, { backgroundColor: colors.bg }]}>
                                            <Image
                                                source={{ uri: uriImg }}
                                                style={{ width: '100%', height: 150 }}
                                                resizeMode="contain"
                                            />
                                            <Text style={[styles.zoomHintText, { color: colors.primary }]}>
                                                🔍 Toca para ver el voucher en pantalla completa
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={[styles.bhdWhiteBox, { backgroundColor: colors.bg }]}>
                                            <Feather name="check-circle" size={36} color={colors.success} />
                                            <Text style={[styles.bhdAmount, { color: colors.text }]}>
                                                RD${' '}
                                                {Number(v.monto).toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </Text>
                                            <Text style={[styles.bhdLine, { color: colors.subText }]}>
                                                Método: {v.metodoPago}
                                            </Text>
                                            <Text style={[styles.bhdLine, { color: colors.subText }]}>
                                                Sin imagen adjunta
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={[styles.cardActionsRow, { borderTopColor: colors.inputBg }]}>
                                    <TouchableOpacity
                                        style={[
                                            styles.editBtn,
                                            {
                                                backgroundColor: colors.primarySoft,
                                                borderColor: colors.primarySoft,
                                            },
                                        ]}
                                        onPress={() => abrirModalEditar(v)}
                                    >
                                        <Feather name="edit-2" size={14} color={colors.primary} />
                                        <Text style={[styles.editBtnText, { color: colors.primary }]}>
                                            Modificar
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.deleteBtn,
                                            {
                                                backgroundColor: colors.dangerBg,
                                                borderColor: colors.dangerBg,
                                            },
                                        ]}
                                        onPress={() => eliminarMiPago(v)}
                                    >
                                        <Feather name="trash-2" size={14} color={colors.danger} />
                                        <Text style={[styles.deleteBtnText, { color: colors.danger }]}>
                                            Eliminar
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* MODAL PARA MODIFICAR PAGO */}
            <Modal
                visible={modalEditarVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalEditarVisible(false)}
            >
                <View
                    style={[
                        styles.modalBackdrop,
                        { backgroundColor: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(15, 23, 42, 0.6)' },
                    ]}
                >
                    <View
                        style={[
                            styles.modalCard,
                            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                        ]}
                    >
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Modificar Pago #{pagoEditando?.id}
                                </Text>
                                <Text style={[styles.modalSub, { color: colors.subText }]}>
                                    Al guardar los cambios, el pago se enviará nuevamente a validación.
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalEditarVisible(false)}>
                                <Feather name="x" size={22} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: colors.text }]}>Método de Pago</Text>
                        <View style={styles.pillGroup}>
                            {(['TRANSFERENCIA', 'EFECTIVO'] as const).map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[
                                        styles.choicePill,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                        editMetodo === m && {
                                            backgroundColor: colors.primary,
                                            borderColor: colors.primary,
                                        },
                                    ]}
                                    onPress={() => setEditMetodo(m)}
                                >
                                    <Text
                                        style={[
                                            styles.choicePillText,
                                            { color: colors.text },
                                            editMetodo === m && { color: '#FFFFFF' },
                                        ]}
                                    >
                                        {m}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { color: colors.text }]}>Monto Pagado (RD$)</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            keyboardType="numeric"
                            value={editMonto}
                            onChangeText={setEditMonto}
                            placeholder="0.00"
                            placeholderTextColor={colors.subText}
                        />

                        <Text style={[styles.label, { color: colors.text }]}>Concepto / Detalle</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            value={editConcepto}
                            onChangeText={setEditConcepto}
                            placeholderTextColor={colors.subText}
                        />

                        <TouchableOpacity
                            style={[
                                styles.uploadBox,
                                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                            ]}
                            onPress={() => void seleccionarImagenEdicion()}
                        >
                            <Feather name="image" size={18} color={colors.primary} />
                            <Text style={[styles.uploadTitle, { color: colors.primary }]}>
                                {editVoucherUri
                                    ? 'Cambiar Imagen del Comprobante'
                                    : 'Adjuntar Imagen del Voucher'}
                            </Text>
                        </TouchableOpacity>

                        {editVoucherUri && (
                            <View
                                style={[
                                    styles.previewImageContainer,
                                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                                ]}
                            >
                                <Image
                                    source={{ uri: editVoucherUri }}
                                    style={styles.previewImage}
                                    resizeMode="contain"
                                />
                                <TouchableOpacity
                                    style={[styles.removeImageXBtn, { backgroundColor: colors.danger }]}
                                    onPress={() => setEditVoucherUri(null)}
                                >
                                    <Feather name="x" size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity
                                style={[styles.cancelModalBtn, { backgroundColor: colors.inputBg }]}
                                onPress={() => setModalEditarVisible(false)}
                            >
                                <Text style={[styles.cancelModalText, { color: colors.subText }]}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.submitModalBtn,
                                    { backgroundColor: colors.primary },
                                    guardandoEdicion && { opacity: 0.7 },
                                ]}
                                disabled={guardandoEdicion}
                                onPress={() => void guardarEdicionPago()}
                            >
                                <Feather name="check-circle" size={16} color="#FFFFFF" />
                                <Text style={styles.submitModalText}>
                                    {guardandoEdicion ? 'Guardando...' : 'Actualizar y Enviar'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* VISOR DE VOUCHER */}
            <Modal
                visible={voucherEnVisor !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setVoucherEnVisor(null)}
            >
                <View style={styles.lightboxBackdrop}>
                    <View style={styles.lightboxHeader}>
                        <View>
                            <Text style={styles.lightboxTitle}>{voucherEnVisor?.concepto}</Text>
                            <Text style={styles.lightboxSub}>
                                RD$ {Number(voucherEnVisor?.monto || 0).toLocaleString()} •{' '}
                                {voucherEnVisor?.metodoPago}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.lightboxClose} onPress={() => setVoucherEnVisor(null)}>
                            <Feather name="x" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    {voucherEnVisor?.comprobanteImg && (
                        <Image
                            source={{ uri: desdeBase64Puro(voucherEnVisor.comprobanteImg)! }}
                            style={{ flex: 1, width: '100%', marginVertical: 16 }}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48, gap: 18 },
    headerBanner: { borderRadius: 16, padding: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
    bannerTitle: { fontSize: 18, fontWeight: '800' },
    bannerMeta: { fontSize: 13, marginTop: 4, fontWeight: '600' },
    pdfBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    pdfBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    inputsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    inputCol: { flex: 1, minWidth: 260 },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 42, paddingHorizontal: 12, gap: 8 },
    searchInputDirect: { flex: 1, height: '100%', fontSize: 14, paddingVertical: 0, outlineStyle: 'none' } as any,
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    filterPillText: { fontSize: 12, fontWeight: '700' },
    emptyCard: { width: '100%', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1 },
    vouchersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
    voucherWrapper: { width: 340, borderRadius: 14, padding: 14, borderWidth: 1 },
    vMeta: { fontSize: 12, fontWeight: '800' },
    vApproved: { fontSize: 11, fontWeight: '800' },
    bhdOuter: { borderRadius: 12, padding: 12 },
    blackOverlayTag: { backgroundColor: '#1E293B', padding: 8, borderRadius: 6, marginBottom: 8 },
    blackOverlayText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
    bhdWhiteBox: { borderRadius: 8, padding: 12, alignItems: 'center', gap: 4 },
    bhdAmount: { fontSize: 18, fontWeight: '800', marginVertical: 4 },
    bhdLine: { fontSize: 11 },
    zoomHintText: { fontSize: 10, fontWeight: '700', marginTop: 6 },
    cardActionsRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
    editBtnText: { fontSize: 12, fontWeight: '800' },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
    deleteBtnText: { fontSize: 12, fontWeight: '800' },
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 480, borderRadius: 20, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalSub: { fontSize: 12, marginTop: 2 },
    pillGroup: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    choicePill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    choicePillText: { fontSize: 12, fontWeight: '800' },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 12, outlineStyle: 'none' } as any,
    uploadBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12, marginBottom: 12 },
    uploadTitle: { fontSize: 13, fontWeight: '700' },
    previewImageContainer: { position: 'relative', width: '100%', height: 130, borderRadius: 10, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    previewImage: { width: '100%', height: '100%' },
    removeImageXBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4 },
    cancelModalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cancelModalText: { fontSize: 13, fontWeight: '700' },
    submitModalBtn: { flex: 1.6, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    submitModalText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.92)', padding: 24, justifyContent: 'space-between' },
    lightboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lightboxTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    lightboxSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
    lightboxClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});