import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Modal,
    Platform,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SessionStore, ResiAlert, UserSession } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

const aBase64Puro = (uri: string | null): string | null => {
    if (!uri) return null;
    const partes = uri.split(',');
    return partes.length > 1 ? partes[1] : uri;
};

const normalizarTexto = (txt: string | undefined | null): string =>
    String(txt || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

interface MesAdeudadoItem {
    id: number;
    mesAnio: string;
    montoMes: number;
    montoPendienteDeEsteMes: number;
    descripcion: string;
}

interface FacturaGasItem {
    id: number;
    fecha: string;
    lecturaAnterior: number;
    lecturaActual: number;
    consumoM3: number;
    totalPagar: number;
    estado: string;
}

export default function PropietarioDashboard() {
    const router = useRouter();
    const [session, setSession] = useState<UserSession | null>(() => SessionStore.getSession());
    const idResidencial = session?.idResidencial || 1;
    const miAptoSesion = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

    const { colors, darkMode } = useAppTheme();
    const tealAccent = darkMode ? '#2DD4BF' : '#0F766E';

    const [cargando, setCargando] = useState(true);
    const [enviandoPago, setEnviandoPago] = useState(false);
    const [idPropietarioBD, setIdPropietarioBD] = useState<number | null>(null);
    const [miAptoReal, setMiAptoReal] = useState<string>(miAptoSesion);
    const [nombrePropietarioReal, setNombrePropietarioReal] = useState<string>(session?.nombre || 'Propietario');
    const [recibidoMant, setRecibidoMant] = useState(0);
    const [balanceMant, setBalanceMant] = useState(0);
    const [cuotaReferenciaMes, setCuotaReferenciaMes] = useState(858);

    const [mesesAdeudados, setMesesAdeudados] = useState<MesAdeudadoItem[]>([]);
    const [ultimoMesRegistrado, setUltimoMesRegistrado] = useState<string>('Al corriente');
    const [pagosEnRevisionMant, setPagosEnRevisionMant] = useState<number>(0);

    const [facturasGasPendientes, setFacturasGasPendientes] = useState<FacturaGasItem[]>([]);
    const [ultimaLecturaGas, setUltimaLecturaGas] = useState<FacturaGasItem | null>(null);
    const [pagosEnRevisionGas, setPagosEnRevisionGas] = useState<number>(0);

    const [modalVisible, setModalVisible] = useState(false);
    const [cuentaSeleccionada, setCuentaSeleccionada] = useState<'MANTENIMIENTO' | 'GAS' | 'EXTRA'>('MANTENIMIENTO');
    const [metodoPago, setMetodoPago] = useState<'TRANSFERENCIA' | 'EFECTIVO'>('TRANSFERENCIA');
    const [montoPago, setMontoPago] = useState('');
    const [confirmacionNo, setConfirmacionNo] = useState('');
    const [etiquetaVoucher, setEtiquetaVoucher] = useState('');
    const [imagenVoucherUri, setImagenVoucherUri] = useState<string | null>(null);

    useEffect(() => {
        const currentSession = SessionStore.getSession();
        if (currentSession) {
            setSession(currentSession);
        }
        void cargarEstadoCompletoUnidad();
    }, []);

    const cargarEstadoCompletoUnidad = async () => {
        setCargando(true);
        try {
            const [resProps, resFin, resGas, resPagos] = await Promise.all([
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-financiero?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-gas?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/pagos?idResidencial=${idResidencial}`).catch(() => null),
            ]);

            let aptoBusqueda = miAptoSesion;
            let propIdEncontrado: number | null = null;
            let balanceActualNum = 0;

            if (resProps?.ok) {
                const dataProps = await resProps.json();
                const aptoBuscadoNorm = normalizarTexto(miAptoSesion);
                const nombreBuscado = String(session?.nombre || '').trim().toLowerCase();

                const miInfo = dataProps.find((p: any) => {
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

                if (miInfo) {
                    propIdEncontrado = miInfo.id;
                    aptoBusqueda = miInfo.apto || miInfo.numApto || miAptoSesion;
                    balanceActualNum = parseFloat(String(miInfo.balance ?? miInfo.saldoPendiente ?? 0)) || 0;
                    const abonadoNum = parseFloat(String(miInfo.totalAbonado ?? miInfo.totalabonado ?? 0)) || 0;

                    setIdPropietarioBD(miInfo.id);
                    setMiAptoReal(aptoBusqueda);
                    setNombrePropietarioReal(miInfo.nombre || miInfo.nombrePropietario || session?.nombre || '');
                    setRecibidoMant(abonadoNum);
                    setBalanceMant(balanceActualNum);
                }
            }

            if (resFin?.ok) {
                const dataFin = await resFin.json();
                const registrosOrdenados = dataFin.slice().reverse();

                if (registrosOrdenados.length > 0) {
                    const ultimo = registrosOrdenados[0];
                    const cuotaUltima = parseFloat(ultimo.montoPagar ?? ultimo.cuotaMensual ?? 858) || 858;
                    setCuotaReferenciaMes(cuotaUltima);
                    setUltimoMesRegistrado((ultimo.mesCuota || ultimo.mesAnio || 'Mes actual').toUpperCase());

                    if (balanceActualNum < 0) {
                        let deudaRestante = Math.abs(balanceActualNum);
                        const listaDeuda: MesAdeudadoItem[] = [];

                        for (const reg of registrosOrdenados) {
                            if (deudaRestante <= 0.01) break;
                            const valorMes = parseFloat(reg.montoPagar ?? reg.cuotaMensual ?? cuotaUltima) || cuotaUltima;
                            const montoDeEsteMes = Math.min(deudaRestante, valorMes);

                            listaDeuda.push({
                                id: reg.id,
                                mesAnio: (reg.mesCuota || reg.mesAnio || 'Periodo').toUpperCase(),
                                montoMes: valorMes,
                                montoPendienteDeEsteMes: montoDeEsteMes,
                                descripcion: reg.descripcion || 'Cuota de mantenimiento común',
                            });

                            deudaRestante = Math.max(0, deudaRestante - montoDeEsteMes);
                        }

                        if (deudaRestante > 1) {
                            listaDeuda.push({
                                id: 9999,
                                mesAnio: 'BALANCE ANTERIOR ACUMULADO',
                                montoMes: deudaRestante,
                                montoPendienteDeEsteMes: deudaRestante,
                                descripcion: 'Saldo pendiente de periodos previos',
                            });
                        }

                        setMesesAdeudados(listaDeuda.reverse());
                    } else {
                        setMesesAdeudados([]);
                    }
                } else if (balanceActualNum < 0) {
                    setMesesAdeudados([
                        {
                            id: 1,
                            mesAnio: 'CUOTA MENSUAL PENDIENTE',
                            montoMes: Math.abs(balanceActualNum),
                            montoPendienteDeEsteMes: Math.abs(balanceActualNum),
                            descripcion: 'Mantenimiento ordinario del residencial',
                        },
                    ]);
                }
            }

            if (resPagos?.ok && propIdEncontrado) {
                const allPagos = await resPagos.json();
                const listaPagosMios = allPagos.filter((p: any) => Number(p.idPropietario) === Number(propIdEncontrado));

                const pendMant = listaPagosMios.filter(
                    (p: any) =>
                        p.estado === 'PENDIENTE_VALIDACION' &&
                        !String(p.concepto || '').toLowerCase().includes('gas')
                ).length;

                const pendGas = listaPagosMios.filter(
                    (p: any) =>
                        p.estado === 'PENDIENTE_VALIDACION' &&
                        String(p.concepto || '').toLowerCase().includes('gas')
                ).length;

                setPagosEnRevisionMant(pendMant);
                setPagosEnRevisionGas(pendGas);
            }

            if (resGas?.ok) {
                const dataGas = await resGas.json();
                const aptoNorm = normalizarTexto(aptoBusqueda);

                const misLecturas: FacturaGasItem[] = dataGas
                    .filter((rg: any) => normalizarTexto(rg.apto) === aptoNorm)
                    .map((rg: any) => {
                        const ant = parseFloat(rg.balanceAnterior ?? rg.balanceanterior ?? 0) || 0;
                        const act = parseFloat(rg.balanceNuevo ?? rg.balancenuevo ?? 0) || 0;
                        const total = parseFloat(rg.totalPagar ?? rg.totalapagar ?? 0) || 0;
                        const diferenciaLectura = act - ant;
                        return {
                            id: rg.id,
                            fecha: rg.fecha || 'Reciente',
                            lecturaAnterior: ant,
                            lecturaActual: act,
                            consumoM3: Math.max(0, diferenciaLectura),
                            totalPagar: total,
                            estado: String(rg.estado || 'PENDIENTE').toUpperCase(),
                        };
                    });

                if (misLecturas.length > 0) {
                    const indiceUltimo = misLecturas.length - 1;
                    setUltimaLecturaGas(misLecturas[indiceUltimo]);
                    const pendientesGas = misLecturas.filter(
                        (g) => g.estado === 'PENDIENTE' && g.totalPagar > 0
                    );
                    setFacturasGasPendientes(pendientesGas);
                } else {
                    setUltimaLecturaGas(null);
                    setFacturasGasPendientes([]);
                }
            }
        } catch (error) {
            console.error('Error cargando estado de unidad:', error);
        } finally {
            setCargando(false);
        }
    };

    const deudaTotalMant = balanceMant < 0 ? Math.abs(balanceMant) : 0;
    const deudaTotalGas = facturasGasPendientes.reduce((acc, f) => acc + f.totalPagar, 0);

    const abrirModalPago = (
        tipo: 'MANTENIMIENTO' | 'GAS' | 'EXTRA',
        montoSugerido?: number,
        conceptoSugerido?: string
    ) => {
        setCuentaSeleccionada(tipo);
        setImagenVoucherUri(null);
        setConfirmacionNo('');

        if (tipo === 'MANTENIMIENTO') {
            if (montoSugerido && conceptoSugerido) {
                setMontoPago(montoSugerido.toFixed(2));
                setEtiquetaVoucher(conceptoSugerido);
            } else if (deudaTotalMant > 0) {
                const nombresMeses = mesesAdeudados.map((m) => m.mesAnio).join(', ');
                setMontoPago(deudaTotalMant.toFixed(2));
                setEtiquetaVoucher(
                    `Pago Mantenimiento (${nombresMeses || 'Saldo Pendiente'}) - Apto ${miAptoReal}`
                );
            } else {
                setMontoPago(cuotaReferenciaMes.toFixed(2));
                setEtiquetaVoucher(`Pago Adelantado Mantenimiento - Apto ${miAptoReal}`);
            }
        } else if (tipo === 'GAS') {
            const montoGas = montoSugerido ?? (deudaTotalGas > 0 ? deudaTotalGas : 0);
            setMontoPago(montoGas > 0 ? montoGas.toFixed(2) : '');
            setEtiquetaVoucher(
                conceptoSugerido ||
                `Pago Consumo Gas GLP (${facturasGasPendientes.map((f) => f.fecha).join(', ') || 'Medidor'}) - Apto ${miAptoReal}`
            );
        } else {
            setMontoPago('');
            setEtiquetaVoucher(`Cuota Extraordinaria - Apto ${miAptoReal}`);
        }

        setModalVisible(true);
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
                    reader.onload = () => setImagenVoucherUri(reader.result as string);
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        } else {
            // VERSIÓN MÓVIL NATIVA
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                ResiAlert.warning('Permiso Requerido', 'Necesitamos acceso a tu galería para subir la captura del voucher.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets[0].base64) {
                setImagenVoucherUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
                ResiAlert.toast('Voucher adjuntado correctamente', 'SUCCESS');
            }
        }
    };

    const confirmarPagoPropietario = async () => {
        const montoNum = parseFloat(montoPago) || 0;
        if (montoNum <= 0) {
            ResiAlert.warning(
                'Monto Inválido',
                'Por favor ingresa un monto válido mayor a RD$ 0.00 para reportar tu pago.'
            );
            return;
        }
        if (!idPropietarioBD) {
            ResiAlert.error(
                'Unidad No Vinculada',
                'No se encontró el registro de tu unidad en la base de datos del residencial.'
            );
            return;
        }

        setEnviandoPago(true);

        const prefijoConcepto =
            cuentaSeleccionada === 'GAS' && !etiquetaVoucher.toLowerCase().includes('gas')
                ? `Pago Consumo Gas GLP - ${etiquetaVoucher}`
                : etiquetaVoucher;

        const payload = {
            idResidencial,
            idPropietario: idPropietarioBD,
            monto: montoNum,
            metodoPago,
            concepto: prefijoConcepto + (confirmacionNo.trim() ? ` (Ref: ${confirmacionNo.trim()})` : ''),
            comprobanteImg: aBase64Puro(imagenVoucherUri),
            estado: 'PENDIENTE_VALIDACION',
            fechaPago: new Date().toISOString(),
        };

        try {
            const res = await fetch(`${API_BASE}/pagos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setModalVisible(false);
                await cargarEstadoCompletoUnidad();
                ResiAlert.success(
                    'Comprobante Enviado',
                    '¡Tu comprobante fue enviado al administrador! Se aplicará automáticamente a tu estado de cuenta tan pronto sea validado.'
                );
            } else {
                ResiAlert.error(
                    'No se pudo registrar',
                    'Hubo un inconveniente al guardar el pago en el servidor. Inténtalo de nuevo.'
                );
            }
        } catch (error) {
            console.error('Error enviando pago:', error);
            ResiAlert.error(
                'Error de Conexión',
                'No se pudo conectar con el servidor de ResiFlow. Verifica tu conexión a internet.'
            );
        } finally {
            setEnviandoPago(false);
        }
    };

    const tieneDeudaMant = balanceMant < 0;
    const tieneDeudaGas = deudaTotalGas > 0;

    if (cargando) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.subText, fontWeight: '600' }}>
                    Consultando estado de cuenta de Apto {miAptoReal}...
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            {/* CUENTA 1: MANTENIMIENTO DEL RESIDENCIAL */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.tagBlue, { color: colors.primary }]}>
                            CUENTA 1 • MANTENIMIENTO DEL RESIDENCIAL
                        </Text>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>
                            Apto {miAptoReal} • Propietario: {nombrePropietarioReal}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.statusBadgeGreen,
                            { backgroundColor: colors.successBg },
                            tieneDeudaMant && { backgroundColor: colors.dangerBg },
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusBadgeText,
                                { color: colors.success },
                                tieneDeudaMant && { color: colors.danger },
                            ]}
                        >
                            {tieneDeudaMant
                                ? `▲ DEBE ${mesesAdeudados.length} ${mesesAdeudados.length === 1 ? 'MES' : 'MESES'}`
                                : '● AL DÍA (SOLVENTE)'}
                        </Text>
                    </View>
                </View>

                {/* MÉTRICAS PRINCIPALES */}
                <View style={styles.metricsRow}>
                    <View style={[styles.metricBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.subText }]}>Total Abonado a la Fecha</Text>
                        <Text style={[styles.metricVal, { color: colors.text }]}>
                            RD$ {recibidoMant.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={[styles.metricSub, { color: colors.subText }]}>Histórico de pagos aprobados</Text>
                    </View>

                    <View
                        style={[
                            styles.metricBox,
                            tieneDeudaMant
                                ? { backgroundColor: colors.dangerBg, borderColor: colors.danger }
                                : { backgroundColor: colors.successBg, borderColor: colors.success },
                        ]}
                    >
                        <Text
                            style={[
                                styles.metricLabel,
                                tieneDeudaMant ? { color: colors.danger } : { color: colors.success },
                            ]}
                        >
                            {tieneDeudaMant ? 'Total Pendiente a Pagar' : 'Balance Actual'}
                        </Text>
                        <Text
                            style={[
                                styles.metricVal,
                                tieneDeudaMant ? { color: colors.danger } : { color: colors.success },
                            ]}
                        >
                            {tieneDeudaMant
                                ? `RD$ ${deudaTotalMant.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                : `RD$ +${balanceMant.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        </Text>
                        <Text
                            style={[
                                styles.metricSub,
                                tieneDeudaMant ? { color: colors.danger } : { color: colors.success },
                            ]}
                        >
                            {tieneDeudaMant
                                ? `Acumulado de ${mesesAdeudados.length} ${mesesAdeudados.length === 1 ? 'periodo' : 'periodos'}`
                                : `No debes ningún mes (Último: ${ultimoMesRegistrado})`}
                        </Text>
                    </View>
                </View>

                {/* DESGLOSE INTELIGENTE DE MESES ADEUDADOS O ESTADO SOLVENTE */}
                {tieneDeudaMant ? (
                    <View
                        style={[
                            styles.debtBreakdownBox,
                            { backgroundColor: darkMode ? '#450a0a' : '#FFF5F5', borderColor: colors.danger },
                        ]}
                    >
                        <View style={styles.debtHeaderRow}>
                            <Feather name="alert-circle" size={16} color={colors.danger} />
                            <Text style={[styles.debtHeaderTitle, { color: colors.danger }]}>
                                Desglose de Meses Pendientes de Pago ({mesesAdeudados.length}):
                            </Text>
                        </View>

                        {mesesAdeudados.map((m) => (
                            <View
                                key={`${m.id}-${m.mesAnio}`}
                                style={[
                                    styles.debtMonthRow,
                                    { backgroundColor: colors.card, borderColor: colors.dangerBg },
                                ]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.debtMonthName, { color: colors.text }]}>
                                        Mes: {m.mesAnio}
                                    </Text>
                                    <Text style={[styles.debtMonthDesc, { color: colors.subText }]}>
                                        {m.descripcion}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={[styles.debtMonthAmount, { color: colors.danger }]}>
                                        RD$ {m.montoPendienteDeEsteMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.paySingleMonthBtn, { backgroundColor: colors.dangerBg }]}
                                        onPress={() =>
                                            abrirModalPago(
                                                'MANTENIMIENTO',
                                                m.montoPendienteDeEsteMes,
                                                `Pago Mantenimiento ${m.mesAnio} - Apto ${miAptoReal}`
                                            )
                                        }
                                    >
                                        <Text style={[styles.paySingleMonthTxt, { color: colors.danger }]}>
                                            Pagar este mes
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View
                        style={[
                            styles.upToDateBox,
                            { backgroundColor: colors.successBg, borderColor: colors.success },
                        ]}
                    >
                        <Feather name="check-circle" size={18} color={colors.success} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.upToDateTitle, { color: colors.success }]}>
                                ¡Estás 100% al día con el mantenimiento del residencial!
                            </Text>
                            <Text style={[styles.upToDateSub, { color: colors.success }]}>
                                No tienes meses pendientes. Tu total histórico abonado es de RD${' '}
                                {recibidoMant.toLocaleString('en-US', { minimumFractionDigits: 2 })}.
                            </Text>
                        </View>
                    </View>
                )}

                {pagosEnRevisionMant > 0 && (
                    <View style={[styles.pendingReviewBanner, { backgroundColor: colors.warningBg }]}>
                        <Feather name="clock" size={15} color={colors.warning} />
                        <Text style={[styles.pendingReviewText, { color: colors.warning }]}>
                            Tienes {pagosEnRevisionMant} comprobante(s) de mantenimiento en revisión por el administrador.
                        </Text>
                    </View>
                )}

                <View style={styles.buttonsRow}>
                    <TouchableOpacity
                        style={[styles.payPrimaryBtn, { backgroundColor: colors.primary }]}
                        onPress={() => abrirModalPago('MANTENIMIENTO')}
                    >
                        <Feather name="credit-card" size={18} color="#FFFFFF" />
                        <Text style={styles.payPrimaryBtnText}>
                            {tieneDeudaMant
                                ? `Pagar Total Adeudado (RD$ ${deudaTotalMant.toLocaleString()})`
                                : 'Reportar Pago / Abono por Adelantado'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.secondaryDarkBtn,
                            {
                                backgroundColor: darkMode ? colors.inputBg : '#2D3E4E',
                                borderColor: colors.border,
                                borderWidth: darkMode ? 1 : 0,
                            },
                        ]}
                        onPress={() => router.push('/(propietario)/mis-pagos')}
                    >
                        <Feather name="file-text" size={17} color="#FFFFFF" />
                        <Text style={styles.secondaryDarkBtnText}>Ver Mis Recibos y PDF</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* CUENTA 2: MEDIDOR DE GAS GLP COMÚN */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: tealAccent }]}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.tagBlue, { color: tealAccent }]}>
                            CUENTA 2 • MEDIDOR DE GAS GLP INDIVIDUAL (m³)
                        </Text>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>
                            Estado de Consumo de Gas - Apto {miAptoReal}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.statusBadgeGreen,
                            {
                                backgroundColor:
                                    pagosEnRevisionGas > 0
                                        ? colors.warningBg
                                        : tieneDeudaGas
                                            ? colors.dangerBg
                                            : colors.successBg,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusBadgeText,
                                {
                                    color:
                                        pagosEnRevisionGas > 0
                                            ? colors.warning
                                            : tieneDeudaGas
                                                ? colors.danger
                                                : colors.success,
                                },
                            ]}
                        >
                            {pagosEnRevisionGas > 0
                                ? `● ${pagosEnRevisionGas} PAGO EN REVISIÓN`
                                : tieneDeudaGas
                                    ? `▲ DEBE RD$ ${deudaTotalGas.toLocaleString()}`
                                    : '● AL DÍA (SIN DEUDA)'}
                        </Text>
                    </View>
                </View>

                {tieneDeudaGas ? (
                    <View
                        style={[
                            styles.gasBreakdownBox,
                            { backgroundColor: darkMode ? '#451a03' : '#FFFBEB', borderColor: colors.warning },
                        ]}
                    >
                        <Text style={[styles.gasBreakdownTitle, { color: colors.warning }]}>
                            Tienes {facturasGasPendientes.length} lectura(s) de Gas GLP pendiente(s) de pago:
                        </Text>
                        {facturasGasPendientes.map((fg) => (
                            <View
                                key={fg.id}
                                style={[
                                    styles.gasInvoiceRow,
                                    { backgroundColor: colors.card, borderColor: colors.warningBg },
                                ]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.gasInvoiceDate, { color: colors.text }]}>
                                        Fecha de corte: {fg.fecha}
                                    </Text>
                                    <Text style={[styles.gasInvoiceReadings, { color: colors.subText }]}>
                                        Lectura Ant: {fg.lecturaAnterior} m³ → Act: {fg.lecturaActual} m³ (Consumo:{' '}
                                        {fg.consumoM3.toFixed(1)} m³)
                                    </Text>
                                </View>
                                <Text style={[styles.gasInvoiceTotal, { color: colors.warning }]}>
                                    RD$ {fg.totalPagar.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View
                        style={[
                            styles.upToDateBox,
                            { backgroundColor: darkMode ? '#042f2e' : '#F0FDFA', borderColor: tealAccent },
                        ]}
                    >
                        <Feather name="check-circle" size={18} color={tealAccent} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.upToDateTitle, { color: tealAccent }]}>
                                No debes ningún recibo de Gas GLP
                            </Text>
                            <Text style={[styles.upToDateSub, { color: tealAccent }]}>
                                {ultimaLecturaGas
                                    ? `Última lectura registrada (${ultimaLecturaGas.fecha}): ${ultimaLecturaGas.lecturaActual} m³ • Estado: ${ultimaLecturaGas.estado}`
                                    : 'Aún no tienes cargos de gas pendientes para tu unidad.'}
                            </Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.payGasBtn, { backgroundColor: '#0F766E' }]}
                    onPress={() => abrirModalPago('GAS')}
                >
                    <Feather name="upload" size={18} color="#FFFFFF" />
                    <Text style={styles.payPrimaryBtnText}>
                        {tieneDeudaGas
                            ? `Pagar Consumo de Gas GLP (RD$ ${deudaTotalGas.toLocaleString()})`
                            : 'Reportar Comprobante de Gas GLP'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* MODAL DE REGISTRO DE PAGO */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View
                    style={[
                        styles.modalBackdrop,
                        { backgroundColor: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(15, 23, 42, 0.55)' },
                    ]}
                >
                    <View
                        style={[
                            styles.modalCard,
                            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                        ]}
                    >
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Registrar Pago / Subir Voucher
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.subText, marginTop: 2 }}>
                                    Unidad: Apto {miAptoReal} • {nombrePropietarioReal}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={22} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.label, { color: colors.text }]}>¿Qué cuenta deseas pagar?</Text>
                            <View style={styles.pillGroup}>
                                {[
                                    { id: 'MANTENIMIENTO', label: 'Mantenimiento' },
                                    { id: 'GAS', label: 'Gas GLP' },
                                    { id: 'EXTRA', label: 'Extraordinaria' },
                                ].map((c) => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[
                                            styles.choicePill,
                                            { backgroundColor: colors.inputBg, borderColor: colors.border },
                                            cuentaSeleccionada === c.id && {
                                                backgroundColor: colors.primary,
                                                borderColor: colors.primary,
                                            },
                                        ]}
                                        onPress={() => abrirModalPago(c.id as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.choicePillText,
                                                { color: colors.text },
                                                cuentaSeleccionada === c.id && { color: '#FFFFFF' },
                                            ]}
                                        >
                                            {c.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {cuentaSeleccionada === 'MANTENIMIENTO' && mesesAdeudados.length > 0 && (
                                <View style={{ marginBottom: 12 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>
                                        Seleccionar Mes a Pagar:
                                    </Text>
                                    <View style={styles.pillGroup}>
                                        <TouchableOpacity
                                            style={[
                                                styles.quickMonthBtn,
                                                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                                            ]}
                                            onPress={() => {
                                                setMontoPago(deudaTotalMant.toFixed(2));
                                                setEtiquetaVoucher(
                                                    `Pago Total Mantenimiento (${mesesAdeudados.map((m) => m.mesAnio).join(', ')}) - Apto ${miAptoReal}`
                                                );
                                            }}
                                        >
                                            <Text style={[styles.quickMonthTxt, { color: colors.primary }]}>
                                                Todo (RD$ {deudaTotalMant.toLocaleString()})
                                            </Text>
                                        </TouchableOpacity>

                                        {mesesAdeudados.map((m) => (
                                            <TouchableOpacity
                                                key={m.mesAnio}
                                                style={[
                                                    styles.quickMonthBtn,
                                                    {
                                                        backgroundColor: colors.primarySoft,
                                                        borderColor: colors.primary,
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setMontoPago(m.montoPendienteDeEsteMes.toFixed(2));
                                                    setEtiquetaVoucher(
                                                        `Pago Mantenimiento ${m.mesAnio} - Apto ${miAptoReal}`
                                                    );
                                                }}
                                            >
                                                <Text style={[styles.quickMonthTxt, { color: colors.primary }]}>
                                                    {m.mesAnio} (RD$ {m.montoPendienteDeEsteMes.toLocaleString()})
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <Text style={[styles.label, { color: colors.text }]}>2. Método de Pago</Text>
                            <View style={styles.pillGroup}>
                                {(['TRANSFERENCIA', 'EFECTIVO'] as const).map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[
                                            styles.choicePill,
                                            {
                                                flex: 1,
                                                alignItems: 'center',
                                                backgroundColor: colors.inputBg,
                                                borderColor: colors.border,
                                            },
                                            metodoPago === m && {
                                                backgroundColor: colors.primary,
                                                borderColor: colors.primary,
                                            },
                                        ]}
                                        onPress={() => setMetodoPago(m)}
                                    >
                                        <Text
                                            style={[
                                                styles.choicePillText,
                                                { color: colors.text },
                                                metodoPago === m && { color: '#FFFFFF' },
                                            ]}
                                        >
                                            {m}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
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
                                        value={montoPago}
                                        onChangeText={setMontoPago}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                                <View style={{ flex: 1.3 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>
                                        No. Confirmación / Ref
                                    </Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: colors.inputBg,
                                                borderColor: colors.border,
                                                color: colors.text,
                                            },
                                        ]}
                                        value={confirmacionNo}
                                        onChangeText={setConfirmacionNo}
                                        placeholder="Opcional"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.label, { color: colors.text }]}>
                                Concepto / Detalle del Pago
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.inputBg,
                                        borderColor: colors.border,
                                        color: colors.text,
                                    },
                                ]}
                                value={etiquetaVoucher}
                                onChangeText={setEtiquetaVoucher}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.uploadBox,
                                    { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                                ]}
                                onPress={seleccionarImagenVoucher}
                            >
                                <Feather name="image" size={20} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.uploadTitle, { color: colors.primary }]}>
                                        {imagenVoucherUri
                                            ? 'Cambiar Captura del Comprobante'
                                            : 'Adjuntar Foto / Captura del Voucher'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {imagenVoucherUri && (
                                <View
                                    style={[
                                        styles.previewImageContainer,
                                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                                    ]}
                                >
                                    <Image
                                        source={{ uri: imagenVoucherUri }}
                                        style={styles.previewImage}
                                        resizeMode="contain"
                                    />
                                    <TouchableOpacity
                                        style={[styles.removeImageXBtn, { backgroundColor: colors.danger }]}
                                        onPress={() => setImagenVoucherUri(null)}
                                    >
                                        <Feather name="x" size={14} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                            <TouchableOpacity
                                style={[styles.cancelModalBtn, { backgroundColor: colors.inputBg }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={[styles.cancelModalText, { color: colors.subText }]}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.submitModalBtn,
                                    { backgroundColor: colors.primary },
                                    enviandoPago && { opacity: 0.7 },
                                ]}
                                disabled={enviandoPago}
                                onPress={() => void confirmarPagoPropietario()}
                            >
                                <Feather name="check-circle" size={18} color="#FFFFFF" />
                                <Text style={styles.submitModalText}>
                                    {enviandoPago ? 'Enviando...' : 'Enviar para Validación'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48, gap: 20 },
    card: { borderRadius: 18, padding: 22, borderWidth: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    tagBlue: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    cardTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
    statusBadgeGreen: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    metricBox: { flex: 1, minWidth: 190, padding: 16, borderRadius: 14, borderWidth: 1 },
    metricLabel: { fontSize: 12, fontWeight: '700' },
    metricVal: { fontSize: 22, fontWeight: '900', marginVertical: 4 },
    metricSub: { fontSize: 11, fontWeight: '600' },
    debtBreakdownBox: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10 },
    debtHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    debtHeaderTitle: { fontSize: 13, fontWeight: '800' },
    debtMonthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
    debtMonthName: { fontSize: 13, fontWeight: '800' },
    debtMonthDesc: { fontSize: 11, marginTop: 2 },
    debtMonthAmount: { fontSize: 14, fontWeight: '900' },
    paySingleMonthBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    paySingleMonthTxt: { fontSize: 10, fontWeight: '800' },
    upToDateBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
    upToDateTitle: { fontSize: 13, fontWeight: '800' },
    upToDateSub: { fontSize: 12, marginTop: 2 },
    pendingReviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
    pendingReviewText: { fontSize: 12, fontWeight: '700', flex: 1 },
    gasBreakdownBox: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10 },
    gasBreakdownTitle: { fontSize: 13, fontWeight: '800' },
    gasInvoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
    gasInvoiceDate: { fontSize: 13, fontWeight: '800' },
    gasInvoiceReadings: { fontSize: 11, marginTop: 2 },
    gasInvoiceTotal: { fontSize: 15, fontWeight: '900' },
    buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    payPrimaryBtn: { flex: 1.2, minWidth: 240, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    payPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    secondaryDarkBtn: { flex: 1, minWidth: 220, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    secondaryDarkBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    payGasBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    modalTitle: { fontSize: 19, fontWeight: '800' },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    choicePill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
    choicePillText: { fontSize: 12, fontWeight: '800' },
    quickMonthBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    quickMonthTxt: { fontSize: 11, fontWeight: '800' },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 12, outlineStyle: 'none' } as any,
    uploadBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 12 },
    uploadTitle: { fontSize: 13, fontWeight: '700' },
    previewImageContainer: { position: 'relative', width: '100%', height: 130, borderRadius: 10, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    previewImage: { width: '100%', height: '100%' },
    removeImageXBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4 },
    cancelModalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    cancelModalText: { fontSize: 14, fontWeight: '700' },
    submitModalBtn: { flex: 1.5, paddingVertical: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    submitModalText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});