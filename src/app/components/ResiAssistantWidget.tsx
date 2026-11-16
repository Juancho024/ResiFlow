import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
    SessionStore,
    PreferencesStore,
    ResiAlert,
    AppPreferences,
} from '../../app/(auth)/login';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';
const AI_API_BASE = 'https://www.jrtechnology.duckdns.org/ai/api';
const AI_APP_ID = 'resiflow'; // Usa tu mismo canal configurado en el servidor de IA

const normalizarTexto = (txt: string | undefined | null): string =>
    String(txt || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

// ============================================================================
// SUB-COMPONENTE: GRABADOR DE VOZ MINIMALISTA CON ONDAS EN VIVO
// ============================================================================
function GrabadorVozMinimal({
                                darkMode,
                                colors,
                                onAudioListo,
                                onCancelar,
                            }: {
    darkMode: boolean;
    colors: any;
    onAudioListo: (base64: string, duracionSeg: number) => void;
    onCancelar: () => void;
}) {
    const audioRecorder = useAudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
    });
    const [segundos, setSegundos] = useState(0);
    const [iniciado, setIniciado] = useState(false);
    const [barras, setBarras] = useState<number[]>([0.25, 0.4, 0.7, 0.35, 0.6, 0.3, 0.5]);

    useEffect(() => {
        let isMounted = true;
        let timerSegundos: any;
        let timerOndas: any;

        const iniciar = async () => {
            try {
                await AudioModule.setAudioModeAsync({
                    allowsRecording: true,
                    playsInSilentMode: true,
                });
                await audioRecorder.prepareToRecordAsync();
                if (!isMounted) return;

                audioRecorder.record();
                setIniciado(true);

                timerSegundos = setInterval(() => {
                    setSegundos((s) => s + 1);
                }, 1000);

                timerOndas = setInterval(() => {
                    setBarras((prev) => prev.map(() => 0.2 + Math.random() * 0.8));
                }, 160);
            } catch (err) {
                console.error('Error iniciando grabación:', err);
                onCancelar();
            }
        };

        const timeout = setTimeout(iniciar, 200);

        return () => {
            isMounted = false;
            clearTimeout(timeout);
            if (timerSegundos) clearInterval(timerSegundos);
            if (timerOndas) clearInterval(timerOndas);
            try {
                if (audioRecorder.isRecording) {
                    audioRecorder.stop();
                }
            } catch (e) {}
        };
    }, []);

    const finalizarYEnviar = async () => {
        if (!iniciado) return;
        try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            if (uri) {
                const audioBase64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                await FileSystem.deleteAsync(uri, { idempotent: true });
                onAudioListo(audioBase64, segundos);
            } else {
                onCancelar();
            }
        } catch (err) {
            console.error('Error deteniendo grabación:', err);
            onCancelar();
        }
    };

    const formatSegundos = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <View
            style={[
                styles.voiceCard,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                },
            ]}
        >
            <View style={styles.voiceHeaderRow}>
                <View style={styles.recordingIndicatorRow}>
                    <View style={styles.recordingDot} />
                    <Text style={[styles.voiceStatusText, { color: colors.text }]}>
                        {iniciado ? 'Grabando instrucción de voz' : 'Inicializando micrófono...'}
                    </Text>
                </View>
                <Text style={[styles.voiceTimerText, { color: colors.subText }]}>
                    {formatSegundos(segundos)}
                </Text>
            </View>

            <View
                style={[
                    styles.liveTranscriptBox,
                    {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.waveContainer}>
                    {barras.map((altura, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.waveBar,
                                {
                                    height: Math.max(8, Math.round(altura * 34)),
                                    backgroundColor: colors.primary,
                                    opacity: iniciado ? 0.9 : 0.3,
                                },
                            ]}
                        />
                    ))}
                </View>
                <Text style={{ color: colors.subText, fontSize: 12, marginTop: 10 }}>
                    Habla claro y presiona Procesar al terminar
                </Text>
            </View>

            <View style={styles.voiceBtnRow}>
                <TouchableOpacity
                    style={[
                        styles.btnHalf,
                        { backgroundColor: colors.inputBg, marginRight: 6 },
                    ]}
                    onPress={onCancelar}
                >
                    <Text style={{ color: colors.subText, fontWeight: '700', fontSize: 14 }}>
                        Cancelar
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.btnHalf,
                        { backgroundColor: colors.primary, marginLeft: 6 },
                    ]}
                    onPress={finalizarYEnviar}
                    disabled={!iniciado}
                >
                    <Ionicons
                        name="arrow-up-circle"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                        Procesar
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ============================================================================
// COMPONENTE PRINCIPAL: ASISTENTE INTELIGENTE RESIFLOW
// ============================================================================
export function ResiAssistantWidget({
                                        rol = 'PROPIETARIO',
                                        nombreUsuario = 'Usuario',
                                    }: {
    rol?: 'ADMIN' | 'PROPIETARIO' | 'EMPRESA';
    nombreUsuario?: string;
}) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;
    const { colors, darkMode } = useAppTheme();

    const [iaHabilitada, setIaHabilitada] = useState(PreferencesStore.get().iaActiva);
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Estados del flujo de voz
    const [estadoVoz, setEstadoVoz] = useState<'inactivo' | 'grabando' | 'procesando' | 'resultado'>('inactivo');
    const [textoTranscrito, setTextoTranscrito] = useState('');
    const [textoAnimado, setTextoAnimado] = useState('');
    const [respuestaVoz, setRespuestaVoz] = useState('');
    const [accionesEjecutadas, setAccionesEjecutadas] = useState<string[]>([]);

    const saludoInicial =
        rol === 'ADMIN'
            ? `¡Hola ${nombreUsuario.split(' ')[0]}! Soy la IA de ResiFlow. Puedo informarte quiénes tienen pagos pendientes, publicar avisos, registrar lecturas de gas o escanear vouchers. ¿En qué te ayudo?`
            : rol === 'EMPRESA'
                ? `¡Hola ${nombreUsuario.split(' ')[0]}! Soy el asistente Master de ResiFlow. ¿Qué deseas consultar o registrar hoy?`
                : `¡Hola ${nombreUsuario.split(' ')[0]}! Soy la IA de ResiFlow. Puedo decirte tu balance actual, escanear la foto de tu voucher de pago o reportar una avería por voz o texto.`;

    const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'ai' }[]>([
        { text: saludoInicial, sender: 'ai' },
    ]);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        return PreferencesStore.subscribe((prefs: AppPreferences) => {
            setIaHabilitada(prefs.iaActiva);
            if (!prefs.iaActiva) setIsOpen(false);
        });
    }, []);

    // Efecto máquina de escribir para la transcripción de voz
    useEffect(() => {
        if (estadoVoz !== 'resultado' || !textoTranscrito) {
            setTextoAnimado('');
            return;
        }

        let i = 0;
        setTextoAnimado('');
        const interval = setInterval(() => {
            i += 1;
            setTextoAnimado(textoTranscrito.slice(0, i));
            if (i >= textoTranscrito.length) {
                clearInterval(interval);
            }
        }, 18);

        return () => clearInterval(interval);
    }, [textoTranscrito, estadoVoz]);

    const sugerenciasRapidas =
        rol === 'ADMIN'
            ? [
                '¿Quiénes tienen pagos pendientes?',
                'Resumen financiero del residencial',
                '¿Cuáles averías están activas?',
            ]
            : [
                '¿Cuánto debo de mantenimiento y gas?',
                'Reportar avería en áreas comunes',
                'Estado de mis últimos pagos',
            ];

    // ========================================================================
    // 1. OBTENER CONTEXTO EN TIEMPO REAL DESDE SPRING BOOT
    // ========================================================================
    const obtenerContextoResiFlow = async (mensajeUsuario: string) => {
        const session = SessionStore.getSession();
        const idResidencial = session?.idResidencial || 1;
        const miApto = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

        try {
            const [resProps, resPagos, resGas, resReportes, resFin] = await Promise.all([
                fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/pagos?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-gas?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/reportes?idResidencial=${idResidencial}`).catch(() => null),
                fetch(`${API_BASE}/registro-financiero?idResidencial=${idResidencial}`).catch(() => null),
            ]);

            const props = resProps?.ok ? await resProps.json() : [];
            const pagos = resPagos?.ok ? await resPagos.json() : [];
            const gas = resGas?.ok ? await resGas.json() : [];
            const reportes = resReportes?.ok ? await resReportes.json() : [];
            const fin = resFin?.ok ? await resFin.json() : [];

            const ultimoMes = fin.length > 0 ? fin[fin.length - 1] : null;
            const cuotaActual = ultimoMes ? (ultimoMes.montoPagar ?? ultimoMes.cuotaMensual ?? 858) : 858;

            if (rol === 'ADMIN' || rol === 'EMPRESA') {
                let totalRecaudado = 0;
                let totalPorCobrar = 0;

                const detalleProps = props
                    .map((p: any) => {
                        const apto = p.apto || p.numApto || 'S/N';
                        const nom = p.nombre || p.nombrePropietario || 'Residente';
                        const bal = parseFloat(p.balance ?? 0);
                        const abo = parseFloat(p.totalAbonado ?? p.totalabonado ?? 0);
                        totalRecaudado += abo;
                        if (bal < 0) totalPorCobrar += Math.abs(bal);
                        return `- Apto ${apto} (${nom}): Balance RD$ ${bal.toFixed(2)} (${bal < 0 ? 'DEBE/PENDIENTE' : 'AL DÍA'}), Total Abonado: RD$ ${abo.toFixed(2)}`;
                    })
                    .join('\n');

                const pagosPorValidar = pagos
                    .filter((pg: any) => pg.estado === 'PENDIENTE_VALIDACION')
                    .map((pg: any) => `- Pago #${pg.id}: RD$ ${pg.monto} (${pg.metodoPago}) - ${pg.concepto}`)
                    .join('\n') || 'Ninguno pendiente de validación.';

                const averiasActivas = reportes
                    .filter((r: any) => r.estado !== 'Resuelto')
                    .map((r: any) => `- [${r.estado}] Apto ${r.apto}: ${r.titulo} (${r.descripcion})`)
                    .join('\n') || 'No hay averías pendientes.';

                return `
                    ERES EL ASISTENTE INTELIGENTE DE RESIFLOW (SISTEMA DE ADMINISTRACIÓN DE CONDOMINIOS Y RESIDENCIALES).
                    ROL DEL USUARIO ACTUAL: ADMINISTRADOR (${nombreUsuario}).
                    CUOTA MENSUAL ACTUAL DEL RESIDENCIAL: RD$ ${cuotaActual}.

                    📊 RESUMEN FINANCIERO DEL RESIDENCIAL:
                    - Total Histórico Recaudado: RD$ ${totalRecaudado.toFixed(2)}
                    - Total Pendiente por Cobrar (Mora): RD$ ${totalPorCobrar.toFixed(2)}

                    🏢 ESTADO POR APARTAMENTO:
                    ${detalleProps || 'Sin unidades registradas.'}

                    ⏳ PAGOS EN REVISIÓN (PENDIENTES DE VALIDAR):
                    ${pagosPorValidar}

                    🛠️ AVERÍAS Y REPORTES ACTIVOS:
                    ${averiasActivas}

                    --------------------
                    SOLICITUD DEL ADMINISTRADOR:
                    "${mensajeUsuario}"
                `;
            } else {
                const aptoNorm = normalizarTexto(miApto);
                const miProp = props.find(
                    (p: any) =>
                        (session?.id && p.idUsuario === session.id) ||
                        normalizarTexto(p.apto || p.numApto) === aptoNorm
                );

                const balanceMant = parseFloat(miProp?.balance ?? 0);
                const abonadoMant = parseFloat(miProp?.totalAbonado ?? miProp?.totalabonado ?? 0);

                const misGasPendientes = gas.filter(
                    (g: any) =>
                        normalizarTexto(g.apto) === aptoNorm &&
                        String(g.estado || '').toUpperCase() === 'PENDIENTE'
                );
                const deudaGas = misGasPendientes.reduce(
                    (acc: number, g: any) => acc + (parseFloat(g.totalPagar ?? g.totalapagar ?? 0) || 0),
                    0
                );

                const misPagosRecientes = pagos
                    .filter((pg: any) => miProp && Number(pg.idPropietario) === Number(miProp.id))
                    .slice(-5)
                    .map((pg: any) => `- RD$ ${pg.monto} (${pg.concepto}) -> Estado: ${pg.estado}`)
                    .join('\n') || 'Sin pagos reportados recientemente.';

                const avisosComunitarios = reportes
                    .slice(-5)
                    .map((r: any) => `- [${r.rolAutor}] ${r.titulo}: ${r.descripcion} (${r.estado})`)
                    .join('\n') || 'Sin avisos recientes.';

                return `
                    ERES EL ASISTENTE INTELIGENTE DE RESIFLOW (PORTAL DEL PROPIETARIO).
                    PROPIETARIO ACTUAL: ${nombreUsuario} (Apartamento ${miApto}).
                    CUOTA MENSUAL DE REFERENCIA: RD$ ${cuotaActual}.

                    🏠 ESTADO DE CUENTA DE TU UNIDAD (APTO ${miApto}):
                    - Balance de Mantenimiento: RD$ ${balanceMant.toFixed(2)} (${balanceMant < 0 ? `DEBE RD$ ${Math.abs(balanceMant).toFixed(2)}` : 'AL DÍA / SOLVENTE'})
                    - Total Histórico Abonado: RD$ ${abonadoMant.toFixed(2)}
                    - Deuda de Gas GLP Común: RD$ ${deudaGas.toFixed(2)} (${misGasPendientes.length} recibos pendientes)

                    💳 TUS ÚLTIMOS PAGOS REPORTADOS:
                    ${misPagosRecientes}

                    📢 ÚLTIMOS AVISOS Y REPORTES DEL MURO:
                    ${avisosComunitarios}

                    --------------------
                    SOLICITUD DEL PROPIETARIO:
                    "${mensajeUsuario}"
                `;
            }
        } catch (error) {
            return `ERES EL ASISTENTE DE RESIFLOW. Usuario: ${nombreUsuario} (${rol}). Solicitud: "${mensajeUsuario}"`;
        }
    };

    // ========================================================================
    // 2. EJECUTOR AUTOMÁTICO DE ACCIONES EN EL BACKEND DE RESIFLOW
    // ========================================================================
    const ejecutarAccionesEnServidor = async (
        listaAcciones: any[],
        base64VoucherOpcional?: string
    ): Promise<string[]> => {
        const session = SessionStore.getSession();
        const idResidencial = session?.idResidencial || 1;
        const miApto = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';
        const resultados: string[] = [];

        for (const item of listaAcciones) {
            try {
                const tipoRaw = String(item.accion || item.tipoMovimiento || '').toUpperCase();
                const notaConcepto = String(item.concepto || item.nota || item.titulo || '').trim();
                const montoNum = Number(item.monto || 0);

                // ACCIÓN A: REGISTRAR PAGO O SUBIR VOUCHER (Desde voz o cámara)
                if (
                    tipoRaw.includes('PAGO') ||
                    tipoRaw.includes('VOUCHER') ||
                    tipoRaw.includes('INGRESO') ||
                    (base64VoucherOpcional && montoNum > 0)
                ) {
                    const resProps = await fetch(`${API_BASE}/propietarios?idResidencial=${idResidencial}`);
                    const props = resProps.ok ? await resProps.json() : [];
                    const aptoObj = item.apto ? normalizarTexto(item.apto) : normalizarTexto(miApto);

                    const propEncontrado = props.find(
                        (p: any) =>
                            normalizarTexto(p.apto || p.numApto) === aptoObj ||
                            (session?.id && p.idUsuario === session.id)
                    );

                    if (propEncontrado && montoNum > 0) {
                        const payloadPago = {
                            idResidencial,
                            idPropietario: propEncontrado.id,
                            monto: montoNum,
                            metodoPago: String(item.metodoPago || 'TRANSFERENCIA').toUpperCase(),
                            concepto:
                                notaConcepto ||
                                `Pago Mantenimiento reportado por IA - Apto ${propEncontrado.apto || miApto}`,
                            comprobanteImg: base64VoucherOpcional || null,
                            estado: 'PENDIENTE_VALIDACION',
                            fechaPago: new Date().toISOString(),
                        };

                        const res = await fetch(`${API_BASE}/pagos`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payloadPago),
                        });

                        if (res.ok) {
                            resultados.push(
                                `Pago enviado a validación: RD$ ${montoNum.toLocaleString()} (${payloadPago.concepto})`
                            );
                        }
                    }
                }
                // ACCIÓN B: PUBLICAR REPORTE DE AVERÍA O AVISO ADMINISTRATIVO
                else if (
                    tipoRaw.includes('REPORTE') ||
                    tipoRaw.includes('AVERIA') ||
                    tipoRaw.includes('AVISO') ||
                    (montoNum === 0 && notaConcepto.length > 3)
                ) {
                    const payloadReporte = {
                        idResidencial,
                        idUsuario: session?.id || null,
                        apto: rol === 'ADMIN' ? 'ADMIN' : miApto,
                        rolAutor: rol === 'ADMIN' ? 'ADMIN' : 'PROPIETARIO',
                        titulo: item.titulo || (rol === 'ADMIN' ? `📢 Aviso: ${notaConcepto.slice(0, 35)}` : `[Avería] ${notaConcepto.slice(0, 35)}`),
                        descripcion: item.descripcion || notaConcepto,
                        estado: 'Pendiente',
                    };

                    const res = await fetch(`${API_BASE}/reportes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payloadReporte),
                    });

                    if (res.ok) {
                        resultados.push(
                            `${rol === 'ADMIN' ? 'Aviso publicado' : 'Avería reportada'}: "${payloadReporte.titulo}"`
                        );
                    }
                }
            } catch (err) {
                console.error('Error ejecutando acción IA en ResiFlow:', err);
            }
        }

        return resultados;
    };

    // ========================================================================
    // 3. ESCÁNER DE VOUCHERS Y RECIBOS CON IA (/ai/api/vision)
    // ========================================================================
    const abrirGaleriaParaIA = async (): Promise<{ base64: string; mimeType: string } | null> => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            return new Promise((resolve) => {
                const inputEl = document.createElement('input');
                inputEl.type = 'file';
                inputEl.accept = 'image/*';
                inputEl.onchange = (e: any) => {
                    const file = e.target?.files?.[0];
                    if (!file) return resolve(null);
                    const reader = new FileReader();
                    reader.onload = () => {
                        const resultStr = String(reader.result || '');
                        const base64Clean = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
                        resolve({ base64: base64Clean, mimeType: file.type || 'image/jpeg' });
                    };
                    reader.readAsDataURL(file);
                };
                inputEl.click();
            });
        }

        const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            setMessages((prev) => [
                ...prev,
                { text: 'Necesitamos permisos para acceder a tus fotos y leer los comprobantes de pago.', sender: 'ai' },
            ]);
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets[0].base64) {
            return {
                base64: result.assets[0].base64,
                mimeType: result.assets[0].mimeType || 'image/jpeg',
            };
        }
        return null;
    };

    const procesarVoucherConIA = async (base64Image: string, mimeType: string) => {
        setIsTyping(true);
        setMessages((prev) => [
            ...prev,
            { text: '📷 Escaneando comprobante de pago / voucher con IA...', sender: 'user' },
        ]);

        try {
            const session = SessionStore.getSession();
            const miApto = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

            const promptVision = `
                Analiza esta imagen de un comprobante de transferencia bancaria o recibo de pago de condominio (ResiFlow - Apto ${miApto}).
                Extrae el monto pagado, banco o referencia, y devuélvelo en JSON con este formato exacto:
                {
                  "respuesta_chat": "Comprobante leído correctamente por RD$ X.",
                  "ejecutar_accion": true,
                  "movimientos": [
                    {
                      "accion": "REGISTRAR_PAGO",
                      "tipoMovimiento": "INGRESO",
                      "monto": 858,
                      "metodoPago": "TRANSFERENCIA",
                      "nota": "Pago Mantenimiento Apto ${miApto} (Voucher escaneado por IA)"
                    }
                  ]
                }
            `;

            const response = await fetch(`${AI_API_BASE}/vision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: AI_APP_ID,
                    prompt: promptVision,
                    imagen: base64Image,
                    mimeType: mimeType,
                }),
            });

            if (!response.ok) throw new Error('Error en el servidor de visión IA');

            const data = await response.json();
            const textoLimpio = (data.respuesta || '').replace(/```json/g, '').replace(/```/g, '').trim();
            const datosJSON = JSON.parse(textoLimpio);

            const respuestaIA = datosJSON.respuesta_chat || 'Comprobante analizado correctamente.';
            const listaMovimientos = Array.isArray(datosJSON.movimientos) ? datosJSON.movimientos : [];

            if (datosJSON.ejecutar_accion && listaMovimientos.length > 0) {
                const ejecutados = await ejecutarAccionesEnServidor(listaMovimientos, base64Image);
                let resumenTexto = `✅ **${respuestaIA}**`;
                if (ejecutados.length > 0) {
                    resumenTexto += `\n\n${ejecutados.map((e) => `• ${e}`).join('\n')}`;
                    ResiAlert.toast('Voucher registrado y enviado a validación', 'SUCCESS');
                }
                setMessages((prev) => [...prev, { text: resumenTexto, sender: 'ai' }]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { text: respuestaIA || 'No pude detectar un monto válido en el comprobante.', sender: 'ai' },
                ]);
            }
        } catch (error) {
            console.error('Error al procesar voucher con IA:', error);
            setMessages((prev) => [
                ...prev,
                { text: 'Hubo un error procesando la imagen del comprobante. Verifica tu conexión.', sender: 'ai' },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    // ========================================================================
    // 4. CHAT DE TEXTO CON IA (/ai/api/chat)
    // ========================================================================
    const handleSend = async (textoRapido?: string) => {
        const userMsg = (textoRapido ?? input).trim();
        if (!userMsg) return;

        setMessages((prev) => [...prev, { text: userMsg, sender: 'user' }]);
        if (!textoRapido) setInput('');
        setIsTyping(true);

        try {
            const promptOculto = await obtenerContextoResiFlow(userMsg);

            const response = await fetch(`${AI_API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: AI_APP_ID,
                    mensaje: promptOculto,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setMessages((prev) => [...prev, { text: data.respuesta, sender: 'ai' }]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { text: 'Hubo un error de conexión con el servidor de IA.', sender: 'ai' },
                ]);
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { text: 'No se pudo conectar con el asistente de ResiFlow. Revisa tu conexión.', sender: 'ai' },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    // ========================================================================
    // 5. PROCESAMIENTO DE VOZ CON GEMINI (/ai/api/audio)
    // ========================================================================
    const abrirCuadroDeVoz = async () => {
        if (Platform.OS === 'web') {
            ResiAlert.info(
                'Grabación de Voz en Móvil',
                'El grabador de ondas en vivo está optimizado para la aplicación móvil de ResiFlow en Android y iOS.'
            );
            return;
        }
        try {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                setMessages((prev) => [
                    ...prev,
                    { text: 'Necesitas permitir el acceso al micrófono para enviar comandos de voz.', sender: 'ai' },
                ]);
                return;
            }
            setTextoTranscrito('');
            setTextoAnimado('');
            setRespuestaVoz('');
            setAccionesEjecutadas([]);
            setEstadoVoz('grabando');
        } catch (error) {
            console.error('Error al pedir permiso de micrófono:', error);
        }
    };

    const procesarAudioConGemini = async (base64Audio: string, duracionSeg: number) => {
        if (!base64Audio || duracionSeg < 1) {
            setTextoTranscrito('No se detectó ninguna frase.');
            setRespuestaVoz('Mantén la grabación al menos un segundo mientras hablas.');
            setAccionesEjecutadas([]);
            setEstadoVoz('resultado');
            return;
        }

        setEstadoVoz('procesando');
        setIsTyping(true);

        try {
            const instruccionEstrictaAudio =
                'INSTRUCCIÓN CRÍTICA PARA EL AUDIO ADJUNTO EN RESIFLOW: ' +
                '1. Escucha únicamente el audio adjunto. Si está en silencio, devuelve: ' +
                '{"transcripcion": "", "respuesta_chat": "No escuché ninguna instrucción.", "ejecutar_accion": false, "movimientos": []}. ' +
                '2. Si el usuario hace una consulta sobre su balance, morosos, pagos o gas, responde con los datos exactos del contexto en "respuesta_chat" y pon "ejecutar_accion": false. ' +
                '3. Si el usuario pide reportar una avería/aviso o registrar un pago, pon "ejecutar_accion": true e incluye en el array "movimientos" un objeto con: ' +
                '{"accion": "CREAR_REPORTE" o "REGISTRAR_PAGO", "tipoMovimiento": "GASTO" o "INGRESO", "monto": numero, "nota": "descripción de la avería o concepto del pago"}.';

            const contextoBase = await obtenerContextoResiFlow(instruccionEstrictaAudio);

            const response = await fetch(`${AI_API_BASE}/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: AI_APP_ID,
                    audio: base64Audio,
                    prompt: contextoBase,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const textoLimpio = (data.respuesta || '').replace(/```json/g, '').replace(/```/g, '').trim();
                const datosJSON = JSON.parse(textoLimpio);

                const loQueDijo = (datosJSON.transcripcion || '').trim();
                const respuestaIA = datosJSON.respuesta_chat || 'Solicitud procesada.';

                if (!loQueDijo || loQueDijo.toLowerCase() === 'null') {
                    setTextoTranscrito('Sin voz detectada');
                    setRespuestaVoz('No se escuchó ninguna orden clara en el micrófono. Intenta hablar más cerca.');
                    setAccionesEjecutadas([]);
                    setEstadoVoz('resultado');
                    return;
                }

                setTextoTranscrito(loQueDijo);
                setRespuestaVoz(respuestaIA);
                setMessages((prev) => [...prev, { text: `"${loQueDijo}"`, sender: 'user' }]);

                const listaMovimientos = Array.isArray(datosJSON.movimientos)
                    ? datosJSON.movimientos
                    : datosJSON.tipoMovimiento || datosJSON.accion
                        ? [datosJSON]
                        : [];

                if (datosJSON.ejecutar_accion && listaMovimientos.length > 0) {
                    const ejecutados = await ejecutarAccionesEnServidor(listaMovimientos);
                    setAccionesEjecutadas(ejecutados);
                } else {
                    setAccionesEjecutadas([]);
                }

                setMessages((prev) => [...prev, { text: respuestaIA, sender: 'ai' }]);
                setEstadoVoz('resultado');
            } else {
                setEstadoVoz('inactivo');
                setMessages((prev) => [
                    ...prev,
                    { text: 'Error procesando el audio en el servidor.', sender: 'ai' },
                ]);
            }
        } catch (error) {
            console.error('Error en procesarAudioConGemini:', error);
            setEstadoVoz('inactivo');
            setMessages((prev) => [
                ...prev,
                { text: 'No se pudo procesar el audio. Verifica tu conexión.', sender: 'ai' },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const cerrarCuadroResultado = () => {
        setTextoTranscrito('');
        setTextoAnimado('');
        setRespuestaVoz('');
        setAccionesEjecutadas([]);
        setEstadoVoz('inactivo');
    };

    if (!iaHabilitada) return null;

    const formatearTextoIA = (texto: string) => {
        const partes = String(texto || '').split(/\*\*(.*?)\*\*/g);
        return partes.map((parte, index) => {
            if (index % 2 === 1) {
                return (
                    <Text key={index} style={{ fontWeight: '800' }}>
                        {parte}
                    </Text>
                );
            }
            return <Text key={index}>{parte}</Text>;
        });
    };

    return (
        <>
            {!isOpen && (
                <TouchableOpacity
                    style={[
                        styles.fabButton,
                        { borderColor: colors.primary, shadowColor: colors.primary },
                        !isDesktop && {
                            bottom: 140,
                            right: 18,
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                        },
                    ]}
                    activeOpacity={0.88}
                    onPress={() => setIsOpen(true)}
                >
                    <View
                        style={[
                            styles.fabInnerGlow,
                            { backgroundColor: colors.primary },
                            !isDesktop && {
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="shimmer"
                            size={isDesktop ? 26 : 23}
                            color="#FFFFFF"
                        />
                    </View>
                </TouchableOpacity>
            )}

            <Modal
                animationType="fade"
                transparent={true}
                visible={isOpen}
                onRequestClose={() => {
                    cerrarCuadroResultado();
                    setIsOpen(false);
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={[
                        styles.modalOverlay,
                        { backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.78)' : 'rgba(15, 23, 42, 0.65)' },
                    ]}
                >
                    <View
                        style={[
                            styles.chatContainer,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        {/* HEADER */}
                        <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View
                                    style={[
                                        styles.iconBg,
                                        { backgroundColor: colors.primarySoft, borderColor: colors.border },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="shimmer" size={20} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                                        Asistente ResiFlow IA
                                    </Text>
                                    <Text style={{ color: colors.subText, fontSize: 11, fontWeight: '600' }}>
                                        Consultas, voz y escáner de vouchers
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
                                onPress={() => {
                                    cerrarCuadroResultado();
                                    setIsOpen(false);
                                }}
                            >
                                <Feather name="x" size={19} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        {/* ÁREA DE MENSAJES */}
                        <ScrollView
                            ref={scrollViewRef}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                            style={[styles.messagesArea, { backgroundColor: colors.bg }]}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {messages.map((msg, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.msgBubble,
                                        msg.sender === 'user'
                                            ? [styles.msgUser, { backgroundColor: colors.primary }]
                                            : [
                                                styles.msgAi,
                                                {
                                                    backgroundColor: colors.card,
                                                    borderColor: colors.border,
                                                },
                                            ],
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: msg.sender === 'user' ? '#FFFFFF' : colors.text,
                                            lineHeight: 21,
                                            fontSize: 14,
                                            fontWeight: '500',
                                        }}
                                    >
                                        {msg.sender === 'user' ? msg.text : formatearTextoIA(msg.text)}
                                    </Text>
                                </View>
                            ))}

                            {isTyping && (
                                <View
                                    style={[
                                        styles.msgBubble,
                                        styles.msgAi,
                                        { backgroundColor: colors.card, borderColor: colors.border },
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={{ color: colors.subText, fontSize: 13, fontWeight: '600' }}>
                                            Analizando datos del residencial...
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* CHIPS DE SUGERENCIAS RÁPIDAS */}
                            <View style={styles.suggestionsWrap}>
                                {sugerenciasRapidas.map((sug) => (
                                    <TouchableOpacity
                                        key={sug}
                                        style={[
                                            styles.suggestionChip,
                                            { backgroundColor: colors.card, borderColor: colors.border },
                                        ]}
                                        onPress={() => void handleSend(sug)}
                                    >
                                        <Feather name="zap" size={12} color={colors.primary} />
                                        <Text style={[styles.suggestionText, { color: colors.text }]}>
                                            {sug}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* OVERLAY DE GRABACIÓN Y TRANSCRIPCIÓN DE VOZ */}
                        {estadoVoz !== 'inactivo' && (
                            <View style={styles.voiceOverlay}>
                                {estadoVoz === 'grabando' && (
                                    <GrabadorVozMinimal
                                        darkMode={darkMode}
                                        colors={colors}
                                        onAudioListo={procesarAudioConGemini}
                                        onCancelar={cerrarCuadroResultado}
                                    />
                                )}

                                {estadoVoz === 'procesando' && (
                                    <View
                                        style={[
                                            styles.voiceCard,
                                            {
                                                backgroundColor: colors.card,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <ActivityIndicator
                                            size="small"
                                            color={colors.primary}
                                            style={{ marginVertical: 12 }}
                                        />
                                        <Text
                                            style={[
                                                styles.voiceStatusText,
                                                { color: colors.text, textAlign: 'center' },
                                            ]}
                                        >
                                            Transcribiendo audio con Gemini...
                                        </Text>
                                        <Text
                                            style={{
                                                color: colors.subText,
                                                fontSize: 12,
                                                marginTop: 4,
                                                textAlign: 'center',
                                            }}
                                        >
                                            Verificando estado del residencial en tiempo real
                                        </Text>
                                    </View>
                                )}

                                {estadoVoz === 'resultado' && (
                                    <View
                                        style={[
                                            styles.voiceCard,
                                            {
                                                backgroundColor: colors.card,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.sectionCaption, { color: colors.subText }]}>
                                            TRANSCRIPCIÓN
                                        </Text>

                                        <View
                                            style={[
                                                styles.liveTranscriptBox,
                                                {
                                                    backgroundColor: colors.inputBg,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={{
                                                    color: colors.text,
                                                    fontSize: 15,
                                                    fontWeight: '700',
                                                    textAlign: 'center',
                                                    lineHeight: 22,
                                                }}
                                            >
                                                "{textoAnimado}"
                                            </Text>
                                        </View>

                                        {accionesEjecutadas.length > 0 && (
                                            <View style={{ width: '100%', gap: 6, marginBottom: 4 }}>
                                                {accionesEjecutadas.map((accionTxt, index) => (
                                                    <View
                                                        key={index}
                                                        style={[
                                                            styles.actionBanner,
                                                            {
                                                                backgroundColor: colors.successBg,
                                                                borderColor: colors.success,
                                                            },
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name="checkmark-circle"
                                                            size={16}
                                                            color={colors.success}
                                                            style={{ marginRight: 6 }}
                                                        />
                                                        <Text
                                                            style={{
                                                                color: colors.success,
                                                                fontWeight: '700',
                                                                fontSize: 12,
                                                                flexShrink: 1,
                                                            }}
                                                        >
                                                            {accionTxt}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        <Text
                                            style={{
                                                color: colors.subText,
                                                fontSize: 13,
                                                textAlign: 'center',
                                                marginVertical: 12,
                                                lineHeight: 19,
                                            }}
                                        >
                                            {formatearTextoIA(respuestaVoz)}
                                        </Text>

                                        <TouchableOpacity
                                            style={[
                                                styles.btnFullWidth,
                                                { backgroundColor: colors.primary },
                                            ]}
                                            onPress={cerrarCuadroResultado}
                                        >
                                            <Text
                                                style={{
                                                    color: '#FFFFFF',
                                                    fontWeight: '800',
                                                    fontSize: 14,
                                                }}
                                            >
                                                Continuar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* BARRA INFERIOR DE ENTRADA */}
                        <View
                            style={[
                                styles.inputArea,
                                {
                                    borderTopColor: colors.border,
                                    backgroundColor: colors.card,
                                },
                            ]}
                        >
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.inputBg,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="Escribe o usa el micrófono..."
                                placeholderTextColor={colors.subText}
                                value={input}
                                onChangeText={setInput}
                                onSubmitEditing={() => void handleSend()}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.sendBtn,
                                    {
                                        backgroundColor: colors.primarySoft,
                                        borderColor: colors.border,
                                        borderWidth: 1,
                                        marginRight: 6,
                                    },
                                ]}
                                onPress={async () => {
                                    const imagen = await abrirGaleriaParaIA();
                                    if (imagen) {
                                        await procesarVoucherConIA(imagen.base64, imagen.mimeType);
                                    }
                                }}
                            >
                                <Ionicons name="camera-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>

                            {input.trim() ? (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => void handleSend()}
                                >
                                    <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                                    onPress={abrirCuadroDeVoz}
                                >
                                    <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    fabButton: {
        position: 'absolute',
        right: 24,
        bottom: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1E1B4B',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 9,
        zIndex: 999,
    },
    fabInnerGlow: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    chatContainer: {
        width: '100%',
        maxWidth: 440,
        height: 550,
        maxHeight: '88%',
        borderRadius: 22,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 20,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    iconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '800',
        fontSize: 16,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messagesArea: {
        flex: 1,
        padding: 16,
    },
    msgBubble: {
        maxWidth: '86%',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 16,
        marginBottom: 10,
    },
    msgUser: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    msgAi: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
    },
    suggestionsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 6,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    suggestionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    inputArea: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44,
        borderWidth: 1,
        marginRight: 8,
        fontSize: 14,
        outlineStyle: 'none',
    } as any,
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voiceOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(9, 11, 16, 0.84)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 50,
    },
    voiceCard: {
        width: '100%',
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        elevation: 10,
    },
    voiceHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    recordingIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginRight: 8,
    },
    voiceStatusText: {
        fontSize: 15,
        fontWeight: '800',
    },
    voiceTimerText: {
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    sectionCaption: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    liveTranscriptBox: {
        width: '100%',
        minHeight: 84,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
        gap: 6,
    },
    waveBar: {
        width: 4,
        borderRadius: 2,
    },
    actionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        width: '100%',
    },
    voiceBtnRow: {
        flexDirection: 'row',
        width: '100%',
        marginTop: 4,
    },
    btnHalf: {
        flex: 1,
        height: 44,
        flexDirection: 'row',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnFullWidth: {
        width: '100%',
        height: 46,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
});

export default ResiAssistantWidget;