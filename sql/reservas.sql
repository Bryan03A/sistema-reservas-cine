-- Cine Andino · Microservicio de Reservas (reservas, asiento_funcion, boletos)
-- Respaldo: crea y puebla las tablas SIN usar la aplicación (generado con pg_dump desde la semilla).
-- Úsalo solo si la semilla automática falla:  createdb db_reservas && psql -d db_reservas -f sql/reservas.sql
-- Las referencias entre microservicios (cliente_id, funcion_id, asiento_id) son IDs lógicos, sin clave foránea.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SELECT pg_catalog.set_config('search_path', '', false);



--
-- Name: asiento_funcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asiento_funcion (
    id integer NOT NULL,
    funcion_id integer NOT NULL,
    asiento_id integer NOT NULL,
    reserva_id integer,
    estado character varying(12) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    bloqueado_hasta timestamp with time zone
);


--
-- Name: asiento_funcion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asiento_funcion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asiento_funcion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asiento_funcion_id_seq OWNED BY public.asiento_funcion.id;


--
-- Name: boleto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boleto (
    id integer NOT NULL,
    reserva_id integer NOT NULL,
    asiento_funcion_id integer NOT NULL,
    asiento_id integer NOT NULL,
    precio numeric(6,2) NOT NULL,
    codigo_qr character varying(150) NOT NULL,
    estado character varying(10) DEFAULT 'ACTIVO'::character varying NOT NULL,
    emitido_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone,
    etiqueta character varying(10) NOT NULL,
    seccion_tipo character varying(10) NOT NULL
);


--
-- Name: boleto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boleto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boleto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boleto_id_seq OWNED BY public.boleto.id;


--
-- Name: reserva; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva (
    id integer NOT NULL,
    codigo character varying(30) NOT NULL,
    cliente_id integer NOT NULL,
    funcion_id integer NOT NULL,
    gestionado_por integer,
    fecha_reserva timestamp with time zone NOT NULL,
    expira_en timestamp with time zone,
    estado character varying(15) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    cantidad_boletos integer NOT NULL,
    total numeric(8,2) NOT NULL,
    moneda character(3) DEFAULT 'USD'::bpchar NOT NULL,
    confirmada_en timestamp with time zone,
    cancelada_en timestamp with time zone
);


--
-- Name: reserva_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reserva_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reserva_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reserva_id_seq OWNED BY public.reserva.id;


--
-- Name: asiento_funcion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento_funcion ALTER COLUMN id SET DEFAULT nextval('public.asiento_funcion_id_seq'::regclass);


--
-- Name: boleto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleto ALTER COLUMN id SET DEFAULT nextval('public.boleto_id_seq'::regclass);


--
-- Name: reserva id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva ALTER COLUMN id SET DEFAULT nextval('public.reserva_id_seq'::regclass);


--
-- Data for Name: asiento_funcion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.asiento_funcion (id, funcion_id, asiento_id, reserva_id, estado, bloqueado_hasta) VALUES (1, 1, 1, 1, 'OCUPADO', NULL);
INSERT INTO public.asiento_funcion (id, funcion_id, asiento_id, reserva_id, estado, bloqueado_hasta) VALUES (2, 1, 2, 1, 'OCUPADO', NULL);
INSERT INTO public.asiento_funcion (id, funcion_id, asiento_id, reserva_id, estado, bloqueado_hasta) VALUES (3, 2, 30, NULL, 'DISPONIBLE', NULL);


--
-- Data for Name: boleto; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.boleto (id, reserva_id, asiento_funcion_id, asiento_id, precio, codigo_qr, estado, emitido_en, usado_en, etiqueta, seccion_tipo) VALUES (1, 1, 1, 1, 15.00, '81NQdpocA3WV-jOS.EH05AbWlzkb1k0Kr9Kl7cG', 'ACTIVO', '2026-10-26 01:48:01.749+00', NULL, 'A1', 'VIP');
INSERT INTO public.boleto (id, reserva_id, asiento_funcion_id, asiento_id, precio, codigo_qr, estado, emitido_en, usado_en, etiqueta, seccion_tipo) VALUES (2, 1, 2, 2, 15.00, 'cLurYMpadL9Ip4yP.mGVf-edzMhdqyQO-sdfa3W', 'ACTIVO', '2026-10-26 01:48:01.749+00', NULL, 'A2', 'VIP');
INSERT INTO public.boleto (id, reserva_id, asiento_funcion_id, asiento_id, precio, codigo_qr, estado, emitido_en, usado_en, etiqueta, seccion_tipo) VALUES (3, 2, 3, 30, 5.00, 'EUr-ylDMhOl9Nhpi.-64l-guAifCeuIa0ibXAO1', 'ANULADO', '2026-10-26 01:48:01.772+00', NULL, 'E3', 'GENERAL');


--
-- Data for Name: reserva; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reserva (id, codigo, cliente_id, funcion_id, gestionado_por, fecha_reserva, expira_en, estado, cantidad_boletos, total, moneda, confirmada_en, cancelada_en) VALUES (1, 'RSV-DEMO-0001', 3, 1, NULL, '2026-10-26 01:48:01.718+00', NULL, 'CONFIRMADA', 2, 30.00, 'USD', '2026-10-26 01:48:01.718+00', NULL);
INSERT INTO public.reserva (id, codigo, cliente_id, funcion_id, gestionado_por, fecha_reserva, expira_en, estado, cantidad_boletos, total, moneda, confirmada_en, cancelada_en) VALUES (2, 'RSV-DEMO-0002', 4, 2, NULL, '2026-10-26 01:48:01.76+00', NULL, 'CANCELADA', 1, 5.00, 'USD', NULL, '2026-10-26 01:48:01.76+00');


--
-- Name: asiento_funcion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.asiento_funcion_id_seq', 3, true);


--
-- Name: boleto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.boleto_id_seq', 3, true);


--
-- Name: reserva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reserva_id_seq', 2, true);


--
-- Name: asiento_funcion asiento_funcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento_funcion
    ADD CONSTRAINT asiento_funcion_pkey PRIMARY KEY (id);


--
-- Name: boleto boleto_codigo_qr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_codigo_qr_key UNIQUE (codigo_qr);


--
-- Name: boleto boleto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_pkey PRIMARY KEY (id);


--
-- Name: reserva reserva_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_codigo_key UNIQUE (codigo);


--
-- Name: reserva reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_pkey PRIMARY KEY (id);


--
-- Name: asiento_funcion_estado_bloqueado_hasta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asiento_funcion_estado_bloqueado_hasta ON public.asiento_funcion USING btree (estado, bloqueado_hasta);


--
-- Name: asiento_funcion_funcion_id_asiento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX asiento_funcion_funcion_id_asiento_id ON public.asiento_funcion USING btree (funcion_id, asiento_id);


--
-- Name: asiento_funcion_reserva_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asiento_funcion_reserva_id ON public.asiento_funcion USING btree (reserva_id);


--
-- Name: reserva_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reserva_cliente_id ON public.reserva USING btree (cliente_id);


--
-- Name: reserva_estado_expira_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reserva_estado_expira_en ON public.reserva USING btree (estado, expira_en);


--
-- Name: reserva_funcion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reserva_funcion_id ON public.reserva USING btree (funcion_id);


--
-- Name: uq_boleto_vigente_por_asiento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_boleto_vigente_por_asiento ON public.boleto USING btree (asiento_funcion_id) WHERE ((estado)::text <> 'ANULADO'::text);


--
-- Name: asiento_funcion asiento_funcion_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento_funcion
    ADD CONSTRAINT asiento_funcion_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reserva(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: boleto boleto_asiento_funcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_asiento_funcion_id_fkey FOREIGN KEY (asiento_funcion_id) REFERENCES public.asiento_funcion(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: boleto boleto_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reserva(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


