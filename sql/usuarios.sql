-- Cine Andino · Microservicio de Usuarios (roles, usuarios, clientes, fotos de perfil, auditoría)
-- Respaldo: crea y puebla las tablas SIN usar la aplicación (generado con pg_dump desde la semilla).
-- Úsalo solo si la semilla automática falla:  createdb db_usuarios && psql -d db_usuarios -f sql/usuarios.sql
-- Las referencias entre microservicios (cliente_id, funcion_id, asiento_id) son IDs lógicos, sin clave foránea.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SELECT pg_catalog.set_config('search_path', '', false);



--
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    primer_nombre character varying(50) NOT NULL,
    segundo_nombre character varying(50),
    apellido character varying(50) NOT NULL,
    dni character varying(13) NOT NULL,
    nacionalidad character varying(50),
    direccion character varying(200),
    telefono character varying(15),
    correo character varying(120) NOT NULL
);


--
-- Name: cliente_foto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_foto (
    cliente_id integer NOT NULL,
    contenido bytea NOT NULL,
    tipo character varying(20) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone NOT NULL
);


--
-- Name: cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_id_seq OWNED BY public.cliente.id;


--
-- Name: registro_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_auditoria (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    accion character varying(30) NOT NULL,
    entidad character varying(50) NOT NULL,
    entidad_id integer,
    descripcion text,
    fecha_accion timestamp with time zone NOT NULL
);


--
-- Name: registro_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registro_auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registro_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registro_auditoria_id_seq OWNED BY public.registro_auditoria.id;


--
-- Name: rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol (
    id integer NOT NULL,
    nombre character varying(30) NOT NULL,
    descripcion character varying(150),
    estado character varying(10) DEFAULT 'ACTIVO'::character varying NOT NULL
);


--
-- Name: rol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rol_id_seq OWNED BY public.rol.id;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol_id integer NOT NULL,
    estado character varying(10) DEFAULT 'ACTIVO'::character varying NOT NULL,
    ultima_conexion timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_seq OWNED BY public.usuario.id;


--
-- Name: cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente ALTER COLUMN id SET DEFAULT nextval('public.cliente_id_seq'::regclass);


--
-- Name: registro_auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_auditoria ALTER COLUMN id SET DEFAULT nextval('public.registro_auditoria_id_seq'::regclass);


--
-- Name: rol id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol ALTER COLUMN id SET DEFAULT nextval('public.rol_id_seq'::regclass);


--
-- Name: usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id SET DEFAULT nextval('public.usuario_id_seq'::regclass);


--
-- Data for Name: cliente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cliente (id, usuario_id, primer_nombre, segundo_nombre, apellido, dni, nacionalidad, direccion, telefono, correo) VALUES (1, 1, 'Carla', NULL, 'Mendoza', '1700000001', 'Ecuatoriana', NULL, NULL, 'admin@cine.local');
INSERT INTO public.cliente (id, usuario_id, primer_nombre, segundo_nombre, apellido, dni, nacionalidad, direccion, telefono, correo) VALUES (2, 2, 'Diego', NULL, 'Salazar', '1700000002', 'Ecuatoriana', NULL, NULL, 'operador@cine.local');
INSERT INTO public.cliente (id, usuario_id, primer_nombre, segundo_nombre, apellido, dni, nacionalidad, direccion, telefono, correo) VALUES (3, 3, 'Ana', 'María', 'Torres', '1712345678', 'Ecuatoriana', 'Av. Amazonas N24, Quito', '0991234567', 'ana.torres@correo.test');
INSERT INTO public.cliente (id, usuario_id, primer_nombre, segundo_nombre, apellido, dni, nacionalidad, direccion, telefono, correo) VALUES (4, 4, 'Luis', 'Carlos', 'Pérez', '1723456789', 'Ecuatoriana', 'Calle Bolívar 15, Quito', '0987654321', 'luis.perez@correo.test');


--
-- Data for Name: cliente_foto; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: registro_auditoria; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rol; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rol (id, nombre, descripcion, estado) VALUES (1, 'ADMINISTRADOR', 'Control total del sistema', 'ACTIVO');
INSERT INTO public.rol (id, nombre, descripcion, estado) VALUES (2, 'OPERADOR', 'Gestión operativa de cartelera, funciones y reservas', 'ACTIVO');
INSERT INTO public.rol (id, nombre, descripcion, estado) VALUES (3, 'CLIENTE', 'Consulta cartelera y gestiona sus reservas', 'ACTIVO');


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.usuario (id, username, password_hash, rol_id, estado, ultima_conexion, created_at) VALUES (1, 'admin', '$2a$10$nsWQbeUzV0dKQJiErQcKsuwlV/ln6KlQY7wRTsZ6532A/0CJcr1Ra', 1, 'ACTIVO', NULL, '2026-10-26 01:47:58.912+00');
INSERT INTO public.usuario (id, username, password_hash, rol_id, estado, ultima_conexion, created_at) VALUES (2, 'operador', '$2a$10$Tsri5moafPwMTdMb/hrNu.cUarZc5hajJm7NxiXzOF0GtobqeFnHa', 2, 'ACTIVO', NULL, '2026-10-26 01:47:58.999+00');
INSERT INTO public.usuario (id, username, password_hash, rol_id, estado, ultima_conexion, created_at) VALUES (3, 'cliente1', '$2a$10$c/IzINVR9nJPaSnwTMpYuu9zrTQZQ2/NtW.YBadtozY1wUXTQIGHi', 3, 'ACTIVO', NULL, '2026-10-26 01:47:59.086+00');
INSERT INTO public.usuario (id, username, password_hash, rol_id, estado, ultima_conexion, created_at) VALUES (4, 'cliente2', '$2a$10$nemtXDi8JbjyPMQ.IxkvC.95SvH.YIirM4nwOyxduI03lXjo7y1Dm', 3, 'ACTIVO', NULL, '2026-10-26 01:47:59.201+00');


--
-- Name: cliente_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cliente_id_seq', 4, true);


--
-- Name: registro_auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.registro_auditoria_id_seq', 1, false);


--
-- Name: rol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rol_id_seq', 3, true);


--
-- Name: usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_id_seq', 4, true);


--
-- Name: cliente cliente_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_correo_key UNIQUE (correo);


--
-- Name: cliente cliente_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_dni_key UNIQUE (dni);


--
-- Name: cliente_foto cliente_foto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_foto
    ADD CONSTRAINT cliente_foto_pkey PRIMARY KEY (cliente_id);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id);


--
-- Name: cliente cliente_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_usuario_id_key UNIQUE (usuario_id);


--
-- Name: registro_auditoria registro_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_auditoria
    ADD CONSTRAINT registro_auditoria_pkey PRIMARY KEY (id);


--
-- Name: rol rol_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_nombre_key UNIQUE (nombre);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: usuario usuario_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_username_key UNIQUE (username);


--
-- Name: cliente_foto cliente_foto_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_foto
    ADD CONSTRAINT cliente_foto_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cliente cliente_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registro_auditoria registro_auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_auditoria
    ADD CONSTRAINT registro_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario usuario_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.rol(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


