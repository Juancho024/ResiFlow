import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Modal,
    Image,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
    useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SessionStore, ResiAlert } from '../(auth)/login';
import { useAppTheme } from '../../hooks/useAppTheme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_BASE = 'https://www.jrtechnology.duckdns.org/systemmanager/api';

interface AccesoQrItem {
    id: number;
    idResidencial: number;
    apto: string;
    propietario: string;
    tipo: 'AREA_COMUN' | 'AIRBNB';
    destino: string;
    nombreInvitado: string;
    documentoInvitado?: string;
    cantidadPersonas: number;
    fechaInicio: string;
    fechaFin: string;
    tokenQr: string;
    estado: 'ACTIVO' | 'EXPIRADO' | 'CANCELADO';
    usosRegistrados: number;
}

const AREAS_COMUNES = [
    { id: 'Gazebo Principal', icon: 'sun', capacidad: 25, desc: 'Área social techada para actividades y cumpleaños' },
    { id: 'Área de Piscina & BBQ', icon: 'droplet', capacidad: 15, desc: 'Zona húmeda con parrilla de gas/carbón' },
    { id: 'Salón Multiusos Climatizado', icon: 'home', capacidad: 40, desc: 'Salón cerrado para reuniones y eventos formales' },
    { id: 'Terraza Rooftop', icon: 'wind', capacidad: 20, desc: 'Terraza panorámica en el último nivel' },
];

const obtenerUrlImagenQR = (token: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(token)}`;

const formatearFechaHora = (iso: string) => {
    if (!iso) return '';
    return iso.replace('T', ' ').substring(0, 16);
};

export default function ReservasQrScreen() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;
    const { colors } = useAppTheme();

    const scrollRef = useRef<ScrollView>(null);
    const [tecladoAbierto, setTecladoAbierto] = useState(false);

    const session = SessionStore.getSession();
    const idResidencial = session?.idResidencial || 1;
    const esAdmin = session?.rol === 'ADMIN';
    const miApto = session?.unidad?.replace('Apto. ', '').trim() || 'A-1';

    const [pestana, setPestana] = useState<'AREAS' | 'AIRBNB' | 'MIS_PASES'>('AREAS');
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [accesos, setAccesos] = useState<AccesoQrItem[]>([]);

    // Estados Modales Nativos de Fecha y Hora
    const [modalFecha, setModalFecha] = useState<{ visible: boolean; target: 'RESERVA' | 'CHECKIN' | 'CHECKOUT' }>({
        visible: false,
        target: 'RESERVA',
    });
    const [modalHora, setModalHora] = useState<{
        visible: boolean;
        target: 'INICIO_AREA' | 'FIN_AREA' | 'CHECKIN' | 'CHECKOUT';
    }>({ visible: false, target: 'INICIO_AREA' });

    // Formulario Reserva Área Común
    const [areaSeleccionada, setAreaSeleccionada] = useState(AREAS_COMUNES[0].id);
    const [fechaReserva, setFechaReserva] = useState(() => new Date().toISOString().split('T')[0]);
    const [horaInicioArea, setHoraInicioArea] = useState('14:00');
    const [horaFinArea, setHoraFinArea] = useState('20:00');
    const [motivoEvento, setMotivoEvento] = useState('');
    const [invitadosCount, setInvitadosCount] = useState('10');
    const [aptoAdminInput, setAptoAdminInput] = useState(miApto);

    // Formulario Pase Temporal Airbnb / Huésped
    const [huespedNombre, setHuespedNombre] = useState('');
    const [huespedDoc, setHuespedDoc] = useState('');
    const [checkInFecha, setCheckInFecha] = useState(() => new Date().toISOString().split('T')[0]);
    const [checkInHora, setCheckInHora] = useState('15:00');
    const [checkOutFecha, setCheckOutFecha] = useState(() => {
        const manana = new Date(Date.now() + 86400000 * 2);
        return manana.toISOString().split('T')[0];
    });
    const [checkOutHora, setCheckOutHora] = useState('11:00');
    const [personasAirbnb, setPersonasAirbnb] = useState('2');

    // Modal Visor QR y Validador Lector
    const [paseSeleccionado, setPaseSeleccionado] = useState<AccesoQrItem | null>(null);
    const [modalValidadorVisible, setModalValidadorVisible] = useState(false);
    const [tokenValidarInput, setTokenValidarInput] = useState('');
    const [resultadoValidacion, setResultadoValidacion] = useState<any | null>(null);

    useEffect(() => {
        void cargarAccesos();
    }, [idResidencial]);

    // Escucha la apertura/cierre del teclado para dar espacio de scroll en móvil
    useEffect(() => {
        if (Platform.OS === 'web') return;
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

    // Desplaza suavemente el formulario hacia arriba cuando se toca un campo inferior en móvil
    const enfocarInputInferior = () => {
        if (Platform.OS === 'web' || isDesktop) return;
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 180);
    };

    const cargarAccesos = async () => {
        setCargando(true);
        try {
            const res = await fetch(`${API_BASE}/accesos-qr?idResidencial=${idResidencial}`);
            if (res.ok) {
                const data = await res.json();
                setAccesos(data);
            }
        } catch (error) {
            console.log('Error cargando accesos QR:', error);
        } finally {
            setCargando(false);
        }
    };

    // Filtramos las reservas activas de la fecha elegida para mostrar disponibilidad en vivo
    const reservasDelDiaSeleccionado = useMemo(() => {
        return accesos.filter(
            (a) =>
                a.tipo === 'AREA_COMUN' &&
                a.estado === 'ACTIVO' &&
                a.destino === areaSeleccionada &&
                a.fechaInicio.startsWith(fechaReserva)
        );
    }, [accesos, areaSeleccionada, fechaReserva]);

    const misAccesosVisibles = useMemo(() => {
        if (esAdmin) return accesos;
        return accesos.filter(
            (a) => a.apto.toUpperCase() === miApto.toUpperCase() || a.propietario === session?.nombre
        );
    }, [accesos, esAdmin, miApto, session]);

    // =========================================================================
    // GENERADORES INTELIGENTES DE FECHA Y HORA (CON BLOQUEO POR BD)
    // =========================================================================
    const generarProximosDias = () => {
        const dias = [];
        const hoy = new Date();
        for (let i = 0; i < 60; i++) {
            const d = new Date(hoy);
            d.setDate(d.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            const formateada = d.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
            });
            dias.push({ iso, display: formateada.charAt(0).toUpperCase() + formateada.slice(1) });
        }
        return dias;
    };

    const generarHorasDisponibles = () => {
        const horas = [];
        for (let i = 8; i <= 23; i++) {
            const hLabel = `${i.toString().padStart(2, '0')}:00`;
            let bloqueada = false;

            if (pestana === 'AREAS') {
                const minutosSlot = i * 60;
                bloqueada = reservasDelDiaSeleccionado.some((r) => {
                    const hStart = parseInt(r.fechaInicio.substring(11, 13), 10);
                    const mStart = parseInt(r.fechaInicio.substring(14, 16), 10);
                    const hEnd = parseInt(r.fechaFin.substring(11, 13), 10);
                    const mEnd = parseInt(r.fechaFin.substring(14, 16), 10);

                    const startMins = hStart * 60 + mStart;
                    const endMins = hEnd * 60 + mEnd;

                    return minutosSlot >= startMins && minutosSlot < endMins;
                });
            }

            horas.push({ label: hLabel, bloqueada });
        }
        return horas;
    };

    const handleSeleccionFecha = (iso: string) => {
        if (modalFecha.target === 'RESERVA') setFechaReserva(iso);
        else if (modalFecha.target === 'CHECKIN') setCheckInFecha(iso);
        else if (modalFecha.target === 'CHECKOUT') setCheckOutFecha(iso);
        setModalFecha({ visible: false, target: 'RESERVA' });
    };

    const handleSeleccionHora = (hora: string) => {
        if (modalHora.target === 'INICIO_AREA') setHoraInicioArea(hora);
        else if (modalHora.target === 'FIN_AREA') setHoraFinArea(hora);
        else if (modalHora.target === 'CHECKIN') setCheckInHora(hora);
        else if (modalHora.target === 'CHECKOUT') setCheckOutHora(hora);
        setModalHora({ visible: false, target: 'INICIO_AREA' });
    };

    const crearReservaAreaComun = async () => {
        Keyboard.dismiss();
        if (!fechaReserva || !horaInicioArea || !horaFinArea) {
            ResiAlert.warning('Datos Incompletos', 'Selecciona la fecha, hora de inicio y hora de fin.');
            return;
        }

        const inicioISO = `${fechaReserva}T${horaInicioArea}:00`;
        const finISO = `${fechaReserva}T${horaFinArea}:00`;

        setGuardando(true);
        try {
            const payload = {
                idResidencial,
                idUsuario: session?.id,
                apto: esAdmin ? aptoAdminInput.trim() || 'ADMIN' : miApto,
                propietario: session?.nombre || 'Propietario',
                tipo: 'AREA_COMUN',
                destino: areaSeleccionada,
                nombreInvitado: motivoEvento.trim() || `Reserva de ${session?.nombre}`,
                documentoInvitado: 'Propietario / Invitados',
                cantidadPersonas: parseInt(invitadosCount, 10) || 1,
                fechaInicio: inicioISO,
                fechaFin: finISO,
            };

            const res = await fetch(`${API_BASE}/accesos-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                await cargarAccesos();
                setPaseSeleccionado(data);
                ResiAlert.success(
                    '¡Reserva Confirmada!',
                    `Se generó tu código QR de acceso para ${areaSeleccionada} el ${fechaReserva}.`
                );
            } else {
                ResiAlert.error('Horario No Disponible', data.mensaje || 'No se pudo completar la reserva.');
            }
        } catch (e) {
            ResiAlert.error('Error de Conexión', 'No se pudo conectar con el servidor.');
        } finally {
            setGuardando(false);
        }
    };

    const crearPaseAirbnb = async () => {
        Keyboard.dismiss();
        if (!huespedNombre.trim() || !huespedDoc.trim()) {
            ResiAlert.warning(
                'Datos del Huésped Requeridos',
                'Ingresa el nombre completo y cédula/pasaporte del huésped de Airbnb por seguridad del residencial.'
            );
            return;
        }

        const inicioISO = `${checkInFecha}T${checkInHora}:00`;
        const finISO = `${checkOutFecha}T${checkOutHora}:00`;

        setGuardando(true);
        try {
            const aptoObjetivo = esAdmin ? aptoAdminInput.trim() : miApto;
            const payload = {
                idResidencial,
                idUsuario: session?.id,
                apto: aptoObjetivo,
                propietario: session?.nombre || 'Anfitrión',
                tipo: 'AIRBNB',
                destino: `Acceso Peatonal + Apto ${aptoObjetivo} (Airbnb)`,
                nombreInvitado: huespedNombre.trim(),
                documentoInvitado: huespedDoc.trim(),
                cantidadPersonas: parseInt(personasAirbnb, 10) || 1,
                fechaInicio: inicioISO,
                fechaFin: finISO,
            };

            const res = await fetch(`${API_BASE}/accesos-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                setHuespedNombre('');
                setHuespedDoc('');
                await cargarAccesos();
                setPaseSeleccionado(data);
                ResiAlert.success(
                    'Pase Airbnb Generado',
                    `El QR de ${payload.nombreInvitado} estará activo únicamente desde el ${checkInFecha} (${checkInHora}) hasta el ${checkOutFecha} (${checkOutHora}).`
                );
            } else {
                ResiAlert.error('Error en Fechas', data.mensaje || 'Verifica que el Check-Out sea posterior al Check-In.');
            }
        } catch (e) {
            ResiAlert.error('Error de Red', 'No se pudo generar el pase QR.');
        } finally {
            setGuardando(false);
        }
    };

    const cancelarPase = (item: AccesoQrItem) => {
        ResiAlert.confirm({
            titulo: 'Revocar Código QR',
            mensaje: `¿Deseas desactivar inmediatamente el QR de "${item.nombreInvitado}" (${item.destino})? El lector de puerta ya no le permitirá entrar.`,
            textoConfirmar: 'Sí, Revocar QR',
            peligro: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/accesos-qr/${item.id}/cancelar`, { method: 'PUT' });
                    if (res.ok) {
                        await cargarAccesos();
                        setPaseSeleccionado(null);
                        ResiAlert.toast('Código QR desactivado permanentemente', 'INFO');
                    }
                } catch (e) {
                    ResiAlert.error('Error', 'No se pudo cancelar el pase.');
                }
            },
        });
    };

    const validarQrEnServidor = async () => {
        if (!tokenValidarInput.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/accesos-qr/validar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tokenQr: tokenValidarInput.trim(),
                    idResidencial,
                }),
            });
            const data = await res.json();
            setResultadoValidacion(data);
            await cargarAccesos();
        } catch (e) {
            ResiAlert.error('Error', 'Fallo al verificar con el servidor de puertas.');
        }
    };

    const compartirPasePDF = async (pase: AccesoQrItem) => {
        const qrUrl = obtenerUrlImagenQR(pase.tokenQr);
        const nombreCondo = session?.torre || `Residencial #${idResidencial}`;

        const html = `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        body { font-family: 'Helvetica', Arial, sans-serif; background: #F8FAFC; padding: 30px; text-align: center; }
                        .ticket { max-width: 420px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; border: 2px solid #E2E8F0; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
                        .header { background: #1E1B4B; color: #FFFFFF; padding: 22px; }
                        .condo { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
                        .badge { display: inline-block; margin-top: 8px; background: #3B38F6; color: #FFF; padding: 5px 14px; border-radius: 12px; font-size: 11px; font-weight: bold; }
                        .qr-box { padding: 24px; }
                        .qr-img { width: 220px; height: 220px; border: 4px solid #1E1B4B; border-radius: 16px; padding: 8px; }
                        .token { font-family: monospace; font-size: 13px; color: #64748B; margin-top: 8px; font-weight: bold; }
                        .details { padding: 0 24px 24px 24px; text-align: left; font-size: 13px; color: #1E293B; line-height: 1.7; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px solid #F1F5F9; padding: 6px 0; }
                        .footer { background: #F1F5F9; padding: 12px; font-size: 11px; color: #64748B; }
                    </style>
                </head>
                <body>
                    <div class="ticket">
                        <div class="header">
                            <div class="condo">${nombreCondo}</div>
                            <div class="badge">${pase.tipo === 'AIRBNB' ? 'PASE TEMPORAL AIRBNB / HUÉSPED' : 'RESERVA DE ÁREA COMÚN'}</div>
                        </div>
                        <div class="qr-box">
                            <img src="${qrUrl}" class="qr-img" />
                            <div class="token">${pase.tokenQr}</div>
                        </div>
                        <div class="details">
                            <div class="row"><b>Zona Autorizada:</b> <span>${pase.destino}</span></div>
                            <div class="row"><b>Unidad / Apto:</b> <span>Apto ${pase.apto} (${pase.propietario})</span></div>
                            <div class="row"><b>Titular / Huésped:</b> <span>${pase.nombreInvitado}</span></div>
                            <div class="row"><b>Documento ID:</b> <span>${pase.documentoInvitado || 'N/A'}</span></div>
                            <div class="row"><b>Válido Desde:</b> <span>${formatearFechaHora(pase.fechaInicio)}</span></div>
                            <div class="row"><b>Válido Hasta:</b> <span>${formatearFechaHora(pase.fechaFin)}</span></div>
                        </div>
                        <div class="footer">
                            Presenta este código QR frente al lector óptico de la entrada. El código se desactivará automáticamente al finalizar el horario indicado.
                        </div>
                    </div>
                </body>
            </html>
        `;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html + '<script>window.onload = () => window.print();</script>');
                win.document.close();
            }
        } else {
            try {
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Pase QR - ${pase.nombreInvitado}`,
                    });
                }
            } catch (e) {
                ResiAlert.error('Error', 'No se pudo exportar el Pase QR.');
            }
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                ref={scrollRef}
                style={[styles.container, { backgroundColor: colors.bg }]}
                contentContainerStyle={[
                    styles.content,
                    // Cuando el teclado se abre en móvil, añadimos espacio extra abajo para poder deslizar libremente
                    tecladoAbierto && { paddingBottom: 320 },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* CABECERA */}
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.pageTitle, { color: colors.text }]}>
                            Reservas & Accesos Inteligentes QR
                        </Text>
                        <Text style={[styles.pageSub, { color: colors.subText }]}>
                            Agenda áreas sociales o genera llaves QR con caducidad automática para huéspedes de Airbnb
                        </Text>
                    </View>

                    {esAdmin && (
                        <TouchableOpacity
                            style={[styles.scannerBtn, { backgroundColor: '#1E1B4B' }]}
                            onPress={() => {
                                setResultadoValidacion(null);
                                setTokenValidarInput('');
                                setModalValidadorVisible(true);
                            }}
                        >
                            <MaterialCommunityIcons name="qrcode-scan" size={18} color="#4ADE80" />
                            <Text style={styles.scannerBtnText}>Probar Lector de Puerta</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* PESTAÑAS DE NAVEGACIÓN */}
                <View style={[styles.tabsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tabPill, pestana === 'AREAS' && { backgroundColor: colors.primary }]}
                        onPress={() => setPestana('AREAS')}
                    >
                        <Feather name="calendar" size={15} color={pestana === 'AREAS' ? '#FFF' : colors.subText} />
                        <Text style={[styles.tabPillText, { color: pestana === 'AREAS' ? '#FFF' : colors.subText }]}>
                            {isDesktop ? 'Reservar Área Común' : 'Reservar Área'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabPill, pestana === 'AIRBNB' && { backgroundColor: colors.primary }]}
                        onPress={() => setPestana('AIRBNB')}
                    >
                        <Feather name="key" size={15} color={pestana === 'AIRBNB' ? '#FFF' : colors.subText} />
                        <Text style={[styles.tabPillText, { color: pestana === 'AIRBNB' ? '#FFF' : colors.subText }]}>
                            {isDesktop ? 'Pase Temporal Airbnb' : 'Pase Airbnb'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabPill, pestana === 'MIS_PASES' && { backgroundColor: colors.primary }]}
                        onPress={() => setPestana('MIS_PASES')}
                    >
                        <MaterialCommunityIcons
                            name="qrcode"
                            size={16}
                            color={pestana === 'MIS_PASES' ? '#FFF' : colors.subText}
                        />
                        <Text style={[styles.tabPillText, { color: pestana === 'MIS_PASES' ? '#FFF' : colors.subText }]}>
                            {esAdmin ? `Todos los QR (${misAccesosVisibles.length})` : `Mis Pases QR (${misAccesosVisibles.length})`}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* CONTENIDO SEGÚN PESTAÑA */}
                {pestana === 'AREAS' && (
                    <View style={[styles.mainGrid, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
                        {/* Selección de Área Común */}
                        <View
                            style={[
                                styles.card,
                                isDesktop && { flex: 1 },
                                { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                        >
                            <Text style={[styles.cardTitle, { color: colors.text }]}>1. Elige el Área Común</Text>
                            <View style={{ gap: 10, marginTop: 12 }}>
                                {AREAS_COMUNES.map((area) => {
                                    const activa = areaSeleccionada === area.id;
                                    return (
                                        <TouchableOpacity
                                            key={area.id}
                                            style={[
                                                styles.areaOption,
                                                { backgroundColor: colors.inputBg, borderColor: colors.border },
                                                activa && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                                            ]}
                                            onPress={() => setAreaSeleccionada(area.id)}
                                        >
                                            <View style={[styles.areaIconBox, { backgroundColor: activa ? colors.primary : colors.card }]}>
                                                <Feather name={area.icon as any} size={18} color={activa ? '#FFF' : colors.primary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.areaTitle, { color: colors.text }]}>{area.id}</Text>
                                                <Text style={[styles.areaDesc, { color: colors.subText }]}>{area.desc}</Text>
                                            </View>
                                            <View style={[styles.capBadge, { backgroundColor: colors.card }]}>
                                                <Text style={[styles.capBadgeText, { color: colors.primary }]}>
                                                    Máx. {area.capacidad}p
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Calendario y Horario */}
                        <View
                            style={[
                                styles.card,
                                isDesktop && { flex: 1 },
                                { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                        >
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                2. Disponibilidad y Horario
                            </Text>

                            {esAdmin && (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Unidad / Apartamento</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                        value={aptoAdminInput}
                                        onChangeText={setAptoAdminInput}
                                        placeholder="Ej: E-3"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                            )}

                            <View style={{ marginTop: 10 }}>
                                <Text style={[styles.label, { color: colors.text }]}>Fecha del Evento</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setModalFecha({ visible: true, target: 'RESERVA' });
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 13 }}>{fechaReserva}</Text>
                                        <Feather name="calendar" size={16} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Estado de disponibilidad en tiempo real */}
                            <View
                                style={[
                                    styles.availabilityBanner,
                                    {
                                        backgroundColor:
                                            reservasDelDiaSeleccionado.length === 0 ? colors.successBg : colors.warningBg,
                                    },
                                ]}
                            >
                                <Feather
                                    name={reservasDelDiaSeleccionado.length === 0 ? 'check-circle' : 'clock'}
                                    size={16}
                                    color={reservasDelDiaSeleccionado.length === 0 ? colors.success : colors.warning}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: '800',
                                            color: reservasDelDiaSeleccionado.length === 0 ? colors.success : colors.warning,
                                        }}
                                    >
                                        {reservasDelDiaSeleccionado.length === 0
                                            ? `✓ ${areaSeleccionada} 100% libre el ${fechaReserva}`
                                            : `Horarios ya ocupados el ${fechaReserva}:`}
                                    </Text>
                                    {reservasDelDiaSeleccionado.map((r) => (
                                        <Text key={r.id} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
                                            • De {r.fechaInicio.substring(11, 16)} a {r.fechaFin.substring(11, 16)} (Apto {r.apto})
                                        </Text>
                                    ))}
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Hora Inicio</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setModalHora({ visible: true, target: 'INICIO_AREA' });
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: colors.text, fontSize: 13 }}>{horaInicioArea}</Text>
                                            <Feather name="clock" size={16} color={colors.primary} />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Hora Fin</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setModalHora({ visible: true, target: 'FIN_AREA' });
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: colors.text, fontSize: 13 }}>{horaFinArea}</Text>
                                            <Feather name="clock" size={16} color={colors.primary} />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <View style={{ flex: 2, minWidth: 0 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Motivo / Actividad</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                        value={motivoEvento}
                                        onChangeText={setMotivoEvento}
                                        onFocus={enfocarInputInferior}
                                        placeholder="Ej: Cumpleaños familiar"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Invitados</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                        value={invitadosCount}
                                        onChangeText={setInvitadosCount}
                                        onFocus={enfocarInputInferior}
                                        keyboardType="numeric"
                                        selectTextOnFocus
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: colors.primary }, guardando && { opacity: 0.7 }]}
                                disabled={guardando}
                                onPress={() => void crearReservaAreaComun()}
                            >
                                <MaterialCommunityIcons name="qrcode-plus" size={20} color="#FFF" />
                                <Text style={styles.primaryBtnText}>
                                    {guardando ? 'Verificando Calendario...' : 'Confirmar Reserva y Generar QR'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {pestana === 'AIRBNB' && (
                    <View style={[styles.card, { maxWidth: 680, alignSelf: 'center', width: '100%', backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <View style={[styles.areaIconBox, { backgroundColor: '#FF5A5F20' }]}>
                                <Feather name="key" size={22} color="#FF5A5F" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    Generar Llave QR Temporal para Airbnb / Huésped
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.subText }}>
                                    El código QR permitirá la entrada al residencial y áreas autorizadas únicamente entre la fecha/hora de Check-In y Check-Out.
                                </Text>
                            </View>
                        </View>

                        {esAdmin && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={[styles.label, { color: colors.text }]}>Apartamento Anfitrión</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    value={aptoAdminInput}
                                    onChangeText={setAptoAdminInput}
                                    placeholder="Ej: E-3"
                                    placeholderTextColor={colors.subText}
                                />
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1.4, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.text }]}>Nombre Completo del Huésped</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    value={huespedNombre}
                                    onChangeText={setHuespedNombre}
                                    placeholder="Ej: Michael Smith"
                                    placeholderTextColor={colors.subText}
                                />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.text }]}>Pasaporte / Cédula</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    value={huespedDoc}
                                    onChangeText={setHuespedDoc}
                                    placeholder="Ej: US-9482910"
                                    placeholderTextColor={colors.subText}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.success }]}>Fecha Check-In (Entrada)</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setModalFecha({ visible: true, target: 'CHECKIN' });
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 13 }}>{checkInFecha}</Text>
                                        <Feather name="calendar" size={16} color={colors.success} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 0.7, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.success }]}>Hora Check-In</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setModalHora({ visible: true, target: 'CHECKIN' });
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 13 }}>{checkInHora}</Text>
                                        <Feather name="clock" size={16} color={colors.success} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.danger }]}>Fecha Check-Out (Salida)</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setModalFecha({ visible: true, target: 'CHECKOUT' });
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 13 }}>{checkOutFecha}</Text>
                                        <Feather name="calendar" size={16} color={colors.danger} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 0.7, minWidth: 0 }}>
                                <Text style={[styles.label, { color: colors.danger }]}>Hora Límite</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setModalHora({ visible: true, target: 'CHECKOUT' });
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 13 }}>{checkOutHora}</Text>
                                        <Feather name="clock" size={16} color={colors.danger} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: '#FF5A5F', marginTop: 18 }, guardando && { opacity: 0.7 }]}
                            disabled={guardando}
                            onPress={() => void crearPaseAirbnb()}
                        >
                            <MaterialCommunityIcons name="qrcode-scan" size={20} color="#FFF" />
                            <Text style={styles.primaryBtnText}>
                                {guardando ? 'Generando Llave...' : 'Generar Pase QR para Huésped'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {pestana === 'MIS_PASES' && (
                    <View style={{ gap: 12 }}>
                        {cargando ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
                        ) : misAccesosVisibles.length === 0 ? (
                            <View style={[styles.card, { alignItems: 'center', padding: 36, backgroundColor: colors.card, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="qrcode" size={42} color={colors.subText} />
                                <Text style={{ color: colors.subText, marginTop: 10, fontWeight: '600' }}>
                                    No hay reservas ni pases QR generados todavía.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.qrGrid}>
                                {misAccesosVisibles.map((item) => {
                                    const esAirbnb = item.tipo === 'AIRBNB';
                                    const activo = item.estado === 'ACTIVO';
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            activeOpacity={0.85}
                                            onPress={() => setPaseSeleccionado(item)}
                                            style={[
                                                styles.paseCard,
                                                { backgroundColor: colors.card, borderColor: colors.border },
                                                !activo && { opacity: 0.65 },
                                            ]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View
                                                    style={[
                                                        styles.typeTag,
                                                        { backgroundColor: esAirbnb ? '#FF5A5F20' : colors.primarySoft },
                                                    ]}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: '800',
                                                            color: esAirbnb ? '#FF5A5F' : colors.primary,
                                                        }}
                                                    >
                                                        {esAirbnb ? '🏠 PASE AIRBNB' : '🌴 ÁREA COMÚN'} • Apto {item.apto}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={[
                                                        styles.statusBadge,
                                                        {
                                                            backgroundColor: activo ? colors.successBg : colors.dangerBg,
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: '800',
                                                            color: activo ? colors.success : colors.danger,
                                                        }}
                                                    >
                                                        {item.estado}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'center' }}>
                                                <Image
                                                    source={{ uri: obtenerUrlImagenQR(item.tokenQr) }}
                                                    style={{ width: 74, height: 74, borderRadius: 8 }}
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                                                        {item.destino}
                                                    </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                                                        👤 {item.nombreInvitado}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: colors.subText, marginTop: 4 }}>
                                                        🟢 Desde: {formatearFechaHora(item.fechaInicio)}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: colors.subText }}>
                                                        🔴 Hasta: {formatearFechaHora(item.fechaFin)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={[styles.cardFooterRow, { borderTopColor: colors.inputBg }]}>
                                                <Text style={{ fontSize: 11, color: colors.subText, fontWeight: '700' }}>
                                                    Lecturas en puerta: {item.usosRegistrados || 0}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '800' }}>
                                                    Ver QR / Compartir →
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* MODAL DEL PASE QR DIGITAL PARA MOSTRAR O ENVIAR AL HUÉSPED */}
                <Modal
                    visible={paseSeleccionado !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPaseSeleccionado(null)}
                >
                    <View style={styles.modalBackdrop}>
                        <View style={[styles.ticketModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.ticketHeader}>
                                <View>
                                    <Text style={styles.ticketCondoTitle}>
                                        {session?.torre || `Residencial #${idResidencial}`}
                                    </Text>
                                    <Text style={styles.ticketSub}>
                                        {paseSeleccionado?.tipo === 'AIRBNB'
                                            ? 'LLAVE TEMPORAL AIRBNB / INVITADO'
                                            : 'PASE DE ACCESO A ÁREA COMÚN'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setPaseSeleccionado(null)}>
                                    <Feather name="x" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>

                            {paseSeleccionado && (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <View style={styles.qrFrame}>
                                        <Image
                                            source={{ uri: obtenerUrlImagenQR(paseSeleccionado.tokenQr) }}
                                            style={{ width: 200, height: 200 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text style={[styles.tokenCodeText, { color: colors.subText }]}>
                                        {paseSeleccionado.tokenQr}
                                    </Text>

                                    <View style={[styles.ticketInfoBox, { backgroundColor: colors.inputBg }]}>
                                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                                            📍 {paseSeleccionado.destino}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                                            👤 Titular: <Text style={{ fontWeight: '800' }}>{paseSeleccionado.nombreInvitado}</Text> (Apto {paseSeleccionado.apto})
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700', marginTop: 6 }}>
                                            Inicio: {formatearFechaHora(paseSeleccionado.fechaInicio)}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '700' }}>
                                            Expira: {formatearFechaHora(paseSeleccionado.fechaFin)}
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 16 }}>
                                        <TouchableOpacity
                                            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                                            onPress={() => void compartirPasePDF(paseSeleccionado)}
                                        >
                                            <Feather name="share-2" size={16} color="#FFF" />
                                            <Text style={styles.shareBtnText}>Compartir Pase (WhatsApp / PDF)</Text>
                                        </TouchableOpacity>

                                        {paseSeleccionado.estado === 'ACTIVO' && (
                                            <TouchableOpacity
                                                style={[styles.revokeBtn, { backgroundColor: colors.dangerBg }]}
                                                onPress={() => cancelarPase(paseSeleccionado)}
                                            >
                                                <Feather name="slash" size={16} color={colors.danger} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* MODAL SIMULADOR DE LECTOR DE PUERTA (SOLO ADMIN) */}
                <Modal
                    visible={modalValidadorVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setModalValidadorVisible(false)}
                >
                    <KeyboardAvoidingView
                        style={styles.modalBackdrop}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={[styles.ticketModal, { backgroundColor: colors.card, padding: 22 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                                    Escáner / Validador de Puerta
                                </Text>
                                <TouchableOpacity onPress={() => setModalValidadorVisible(false)}>
                                    <Feather name="x" size={20} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.subText, marginBottom: 12 }}>
                                Pega o escanea con lector USB/Óptico el código del QR para verificar si tiene permiso de abrir la puerta en este instante:
                            </Text>

                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                value={tokenValidarInput}
                                onChangeText={setTokenValidarInput}
                                placeholder="Ej: RF-AIRBNB-2-A8F920..."
                                placeholderTextColor={colors.subText}
                                autoCapitalize="characters"
                            />

                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
                                onPress={() => void validarQrEnServidor()}
                            >
                                <Feather name="check-circle" size={18} color="#FFF" />
                                <Text style={styles.primaryBtnText}>Verificar Acceso Ahora</Text>
                            </TouchableOpacity>

                            {resultadoValidacion && (
                                <View
                                    style={{
                                        marginTop: 14,
                                        padding: 14,
                                        borderRadius: 12,
                                        backgroundColor: resultadoValidacion.acceso ? colors.successBg : colors.dangerBg,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: '900',
                                            color: resultadoValidacion.acceso ? colors.success : colors.danger,
                                        }}
                                    >
                                        {resultadoValidacion.acceso ? '🔓 PUERTA ABIERTA (AUTORIZADO)' : '🔒 ACCESO DENEGADO'}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 4, fontWeight: '700' }}>
                                        {resultadoValidacion.motivo}
                                    </Text>
                                    {resultadoValidacion.invitado && (
                                        <Text style={{ fontSize: 12, color: colors.subText, marginTop: 2 }}>
                                            Huésped/Evento: {resultadoValidacion.invitado} (Apto {resultadoValidacion.apto})
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* MODAL FECHAS (Próximos 60 días) */}
                <Modal visible={modalFecha.visible} transparent animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={[styles.listModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.listModalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.listModalTitle, { color: colors.text }]}>Seleccionar Fecha</Text>
                                <TouchableOpacity onPress={() => setModalFecha({ visible: false, target: modalFecha.target })}>
                                    <Feather name="x" size={20} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ maxHeight: 350 }}>
                                {generarProximosDias().map((dia) => (
                                    <TouchableOpacity
                                        key={dia.iso}
                                        style={[styles.listItem, { borderBottomColor: colors.inputBg }]}
                                        onPress={() => handleSeleccionFecha(dia.iso)}
                                    >
                                        <Text style={[styles.listItemText, { color: colors.text }]}>{dia.display}</Text>
                                        <Text style={[styles.listItemSub, { color: colors.subText }]}>{dia.iso}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* MODAL HORAS (08:00 a 23:00 filtrando bloqueadas por la Base de Datos) */}
                <Modal visible={modalHora.visible} transparent animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={[styles.listModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.listModalHeader, { borderBottomColor: colors.border }]}>
                                <View>
                                    <Text style={[styles.listModalTitle, { color: colors.text }]}>Seleccionar Hora</Text>
                                    {pestana === 'AREAS' && (
                                        <Text style={{ fontSize: 11, color: colors.subText, marginTop: 2 }}>
                                            Filtrando disponibilidad real en Base de Datos
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setModalHora({ visible: false, target: modalHora.target })}>
                                    <Feather name="x" size={20} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ maxHeight: 350 }}>
                                {generarHorasDisponibles().map((h) => (
                                    <TouchableOpacity
                                        key={h.label}
                                        style={[
                                            styles.listItem,
                                            { borderBottomColor: colors.inputBg },
                                            h.bloqueada && { opacity: 0.5, backgroundColor: colors.inputBg },
                                        ]}
                                        onPress={() => {
                                            if (h.bloqueada) {
                                                ResiAlert.warning('Horario Ocupado', 'Esta hora ya está reservada por otro apartamento.');
                                                return;
                                            }
                                            handleSeleccionHora(h.label);
                                        }}
                                        activeOpacity={h.bloqueada ? 1 : 0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.listItemText,
                                                { color: h.bloqueada ? colors.subText : colors.text },
                                                h.bloqueada && { textDecorationLine: 'line-through' },
                                            ]}
                                        >
                                            {h.label} {h.bloqueada ? ' (No Disponible)' : ''}
                                        </Text>
                                        {h.bloqueada ? (
                                            <Feather name="lock" size={16} color={colors.danger} />
                                        ) : (
                                            <Feather name="chevron-right" size={16} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 120, gap: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    pageTitle: { fontSize: 22, fontWeight: '800' },
    pageSub: { fontSize: 13, marginTop: 2 },
    scannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    scannerBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    tabsBar: { flexDirection: 'row', flexWrap: 'wrap', padding: 5, borderRadius: 14, borderWidth: 1, gap: 6 },
    tabPill: { flex: 1, minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
    tabPillText: { fontSize: 12, fontWeight: '800' },
    mainGrid: { gap: 16 },
    card: { width: '100%', borderRadius: 18, padding: 18, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '800' },
    areaOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5 },
    areaIconBox: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    areaTitle: { fontSize: 14, fontWeight: '800' },
    areaDesc: { fontSize: 11, marginTop: 2 },
    capBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    capBadgeText: { fontSize: 10, fontWeight: '800' },
    label: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
    input: {
        width: '100%',
        minWidth: 0,
        height: 42,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 0,
        fontSize: 13,
        includeFontPadding: false,
        textAlignVertical: 'center',
        outlineStyle: 'none',
    } as any,
    availabilityBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, marginTop: 12 },
    primaryBtn: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
    primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
    qrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    paseCard: { width: 350, flexGrow: 1, maxWidth: 460, borderRadius: 16, padding: 16, borderWidth: 1 },
    typeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 18 },
    ticketModal: { width: '100%', maxWidth: 420, borderRadius: 22, overflow: 'hidden', borderWidth: 1 },
    ticketHeader: { backgroundColor: '#1E1B4B', padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ticketCondoTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
    ticketSub: { color: '#A5B4FC', fontSize: 10, fontWeight: '800', marginTop: 2 },
    qrFrame: { padding: 12, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 3, borderColor: '#1E1B4B' },
    tokenCodeText: { fontSize: 12, fontWeight: '800', marginTop: 8, letterSpacing: 0.6 },
    ticketInfoBox: { width: '100%', borderRadius: 12, padding: 14, marginTop: 14 },
    shareBtn: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    shareBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    revokeBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    listModalCard: { width: '100%', maxWidth: 360, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    listModalHeader: { padding: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    listModalTitle: { fontSize: 16, fontWeight: '800' },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    listItemText: { fontSize: 14, fontWeight: '700' },
    listItemSub: { fontSize: 12 },
});