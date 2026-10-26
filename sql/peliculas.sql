-- Cine Andino · Microservicio de Películas (películas, pósters, funciones, salas, secciones, filas, asientos)
-- Respaldo: crea y puebla las tablas SIN usar la aplicación (generado con pg_dump desde la semilla).
-- Úsalo solo si la semilla automática falla:  createdb db_peliculas && psql -d db_peliculas -f sql/peliculas.sql
-- Las referencias entre microservicios (cliente_id, funcion_id, asiento_id) son IDs lógicos, sin clave foránea.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SELECT pg_catalog.set_config('search_path', '', false);



--
-- Name: asiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asiento (
    id integer NOT NULL,
    fila_id integer NOT NULL,
    numero integer NOT NULL,
    estado character varying(10) NOT NULL
);


--
-- Name: asiento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asiento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asiento_id_seq OWNED BY public.asiento.id;


--
-- Name: fila; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fila (
    id integer NOT NULL,
    seccion_id integer NOT NULL,
    letra character varying(1) NOT NULL
);


--
-- Name: fila_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fila_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fila_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fila_id_seq OWNED BY public.fila.id;


--
-- Name: funcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcion (
    id integer NOT NULL,
    pelicula_id integer NOT NULL,
    sala_id integer NOT NULL,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado character varying(15) NOT NULL
);


--
-- Name: funcion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.funcion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: funcion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.funcion_id_seq OWNED BY public.funcion.id;


--
-- Name: pelicula; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pelicula (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    genero character varying(40) NOT NULL,
    duracion_min integer NOT NULL,
    clasificacion character varying(10) NOT NULL,
    estado character varying(10) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pelicula_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pelicula_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pelicula_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pelicula_id_seq OWNED BY public.pelicula.id;


--
-- Name: pelicula_imagen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pelicula_imagen (
    pelicula_id integer NOT NULL,
    contenido bytea NOT NULL,
    tipo character varying(20) NOT NULL,
    version integer NOT NULL,
    actualizado_en timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sala; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sala (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    estado character varying(10) NOT NULL
);


--
-- Name: sala_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sala_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sala_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sala_id_seq OWNED BY public.sala.id;


--
-- Name: seccion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seccion (
    id integer NOT NULL,
    sala_id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion character varying(150),
    tipo character varying(10) NOT NULL,
    precio numeric(6,2) NOT NULL,
    capacidad integer NOT NULL,
    num_filas integer,
    asientos_por_fila integer
);


--
-- Name: seccion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seccion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seccion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seccion_id_seq OWNED BY public.seccion.id;


--
-- Name: asiento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento ALTER COLUMN id SET DEFAULT nextval('public.asiento_id_seq'::regclass);


--
-- Name: fila id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fila ALTER COLUMN id SET DEFAULT nextval('public.fila_id_seq'::regclass);


--
-- Name: funcion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcion ALTER COLUMN id SET DEFAULT nextval('public.funcion_id_seq'::regclass);


--
-- Name: pelicula id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pelicula ALTER COLUMN id SET DEFAULT nextval('public.pelicula_id_seq'::regclass);


--
-- Name: sala id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala ALTER COLUMN id SET DEFAULT nextval('public.sala_id_seq'::regclass);


--
-- Name: seccion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seccion ALTER COLUMN id SET DEFAULT nextval('public.seccion_id_seq'::regclass);


--
-- Data for Name: asiento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (1, 1, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (2, 1, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (3, 1, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (4, 1, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (5, 1, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (6, 1, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (7, 2, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (8, 2, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (9, 2, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (10, 2, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (11, 2, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (12, 2, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (13, 3, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (14, 3, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (15, 3, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (16, 3, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (17, 3, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (18, 3, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (19, 4, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (20, 4, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (21, 4, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (22, 4, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (23, 4, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (24, 4, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (25, 5, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (26, 5, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (27, 5, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (28, 5, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (29, 5, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (30, 5, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (31, 5, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (32, 5, 8, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (33, 6, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (34, 6, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (35, 6, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (36, 6, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (37, 6, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (38, 6, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (39, 6, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (40, 6, 8, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (41, 7, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (42, 7, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (43, 7, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (44, 7, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (45, 7, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (46, 7, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (47, 7, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (48, 7, 8, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (49, 8, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (50, 8, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (51, 8, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (52, 8, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (53, 8, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (54, 8, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (55, 9, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (56, 9, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (57, 9, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (58, 9, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (59, 9, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (60, 9, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (61, 10, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (62, 10, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (63, 10, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (64, 10, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (65, 10, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (66, 10, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (67, 11, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (68, 11, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (69, 11, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (70, 11, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (71, 11, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (72, 11, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (73, 12, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (74, 12, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (75, 12, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (76, 12, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (77, 12, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (78, 12, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (79, 12, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (80, 12, 8, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (81, 13, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (82, 13, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (83, 13, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (84, 13, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (85, 13, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (86, 13, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (87, 13, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (88, 13, 8, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (89, 14, 1, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (90, 14, 2, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (91, 14, 3, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (92, 14, 4, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (93, 14, 5, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (94, 14, 6, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (95, 14, 7, 'ACTIVO');
INSERT INTO public.asiento (id, fila_id, numero, estado) VALUES (96, 14, 8, 'ACTIVO');


--
-- Data for Name: fila; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fila (id, seccion_id, letra) VALUES (1, 1, 'A');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (2, 1, 'B');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (3, 2, 'C');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (4, 2, 'D');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (5, 3, 'E');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (6, 3, 'F');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (7, 3, 'G');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (8, 4, 'A');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (9, 4, 'B');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (10, 5, 'C');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (11, 5, 'D');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (12, 6, 'E');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (13, 6, 'F');
INSERT INTO public.fila (id, seccion_id, letra) VALUES (14, 6, 'G');


--
-- Data for Name: funcion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (1, 1, 1, '2026-10-25', '15:00:00', '16:52:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (2, 2, 1, '2026-10-25', '18:00:00', '19:44:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (3, 3, 1, '2026-10-25', '21:00:00', '22:36:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (4, 4, 2, '2026-10-25', '16:00:00', '18:11:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (5, 1, 2, '2026-10-25', '19:00:00', '20:52:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (6, 2, 2, '2026-10-25', '21:45:00', '23:29:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (7, 2, 1, '2026-10-26', '15:00:00', '16:44:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (8, 3, 1, '2026-10-26', '18:00:00', '19:36:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (9, 4, 1, '2026-10-26', '21:00:00', '23:11:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (10, 1, 2, '2026-10-26', '16:00:00', '17:52:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (11, 2, 2, '2026-10-26', '19:00:00', '20:44:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (12, 3, 2, '2026-10-26', '21:45:00', '23:21:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (13, 3, 1, '2026-10-27', '15:00:00', '16:36:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (14, 4, 1, '2026-10-27', '18:00:00', '20:11:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (15, 1, 1, '2026-10-27', '21:00:00', '22:52:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (16, 2, 2, '2026-10-27', '16:00:00', '17:44:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (17, 3, 2, '2026-10-27', '19:00:00', '20:36:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (18, 4, 2, '2026-10-27', '21:45:00', '23:56:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (19, 4, 1, '2026-10-28', '15:00:00', '17:11:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (20, 1, 1, '2026-10-28', '18:00:00', '19:52:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (21, 2, 1, '2026-10-28', '21:00:00', '22:44:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (22, 3, 2, '2026-10-28', '16:00:00', '17:36:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (23, 4, 2, '2026-10-28', '19:00:00', '21:11:00', 'ACTIVA');
INSERT INTO public.funcion (id, pelicula_id, sala_id, fecha, hora_inicio, hora_fin, estado) VALUES (24, 1, 2, '2026-10-28', '21:45:00', '23:37:00', 'ACTIVA');


--
-- Data for Name: pelicula; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pelicula (id, nombre, descripcion, genero, duracion_min, clasificacion, estado, created_at, updated_at) VALUES (1, 'El Último Faro', 'Un farero y una científica descubren qué guarda la luz que nunca se apaga.', 'Drama', 112, '+12', 'ACTIVA', '2026-10-26 01:48:01.967185', '2026-10-26 01:48:01.967185');
INSERT INTO public.pelicula (id, nombre, descripcion, genero, duracion_min, clasificacion, estado, created_at, updated_at) VALUES (2, 'Noche en el Altiplano', 'Una periodista queda atrapada en un pueblo andino donde nadie quiere hablar.', 'Suspenso', 104, '+15', 'ACTIVA', '2026-10-26 01:48:01.967185', '2026-10-26 01:48:01.967185');
INSERT INTO public.pelicula (id, nombre, descripcion, genero, duracion_min, clasificacion, estado, created_at, updated_at) VALUES (3, 'Los Guardianes del Bosque', 'Tres amigos protegen un bosque mágico de una constructora misteriosa.', 'Animación', 96, 'TP', 'ACTIVA', '2026-10-26 01:48:01.967185', '2026-10-26 01:48:01.967185');
INSERT INTO public.pelicula (id, nombre, descripcion, genero, duracion_min, clasificacion, estado, created_at, updated_at) VALUES (4, 'Código Cuántico', 'Una hacker descubre que su algoritmo puede reescribir el pasado reciente.', 'Ciencia ficción', 131, '+12', 'ACTIVA', '2026-10-26 01:48:01.967185', '2026-10-26 01:48:01.967185');


--
-- Data for Name: pelicula_imagen; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sala; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sala (id, nombre, estado) VALUES (1, 'Sala 1', 'ACTIVA');
INSERT INTO public.sala (id, nombre, estado) VALUES (2, 'Sala 2', 'ACTIVA');


--
-- Data for Name: seccion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (1, 1, 'VIP', 'Butacas reclinables con servicio', 'VIP', 15.00, 12, 2, 6);
INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (2, 1, 'DBOX', 'Butacas con movimiento sincronizado', 'DBOX', 10.00, 12, 2, 6);
INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (3, 1, 'GENERAL', 'Zona general', 'GENERAL', 5.00, 24, 3, 8);
INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (4, 2, 'VIP', 'Butacas reclinables con servicio', 'VIP', 15.00, 12, 2, 6);
INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (5, 2, 'DBOX', 'Butacas con movimiento sincronizado', 'DBOX', 10.00, 12, 2, 6);
INSERT INTO public.seccion (id, sala_id, nombre, descripcion, tipo, precio, capacidad, num_filas, asientos_por_fila) VALUES (6, 2, 'GENERAL', 'Zona general', 'GENERAL', 5.00, 24, 3, 8);


--
-- Name: asiento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.asiento_id_seq', 96, true);


--
-- Name: fila_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fila_id_seq', 14, true);


--
-- Name: funcion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.funcion_id_seq', 24, true);


--
-- Name: pelicula_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pelicula_id_seq', 4, true);


--
-- Name: sala_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sala_id_seq', 2, true);


--
-- Name: seccion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.seccion_id_seq', 6, true);


--
-- Name: asiento asiento_fila_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento
    ADD CONSTRAINT asiento_fila_id_numero_key UNIQUE (fila_id, numero);


--
-- Name: asiento asiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento
    ADD CONSTRAINT asiento_pkey PRIMARY KEY (id);


--
-- Name: fila fila_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fila
    ADD CONSTRAINT fila_pkey PRIMARY KEY (id);


--
-- Name: fila fila_seccion_id_letra_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fila
    ADD CONSTRAINT fila_seccion_id_letra_key UNIQUE (seccion_id, letra);


--
-- Name: funcion funcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcion
    ADD CONSTRAINT funcion_pkey PRIMARY KEY (id);


--
-- Name: pelicula_imagen pelicula_imagen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pelicula_imagen
    ADD CONSTRAINT pelicula_imagen_pkey PRIMARY KEY (pelicula_id);


--
-- Name: pelicula pelicula_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pelicula
    ADD CONSTRAINT pelicula_pkey PRIMARY KEY (id);


--
-- Name: sala sala_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala
    ADD CONSTRAINT sala_nombre_key UNIQUE (nombre);


--
-- Name: sala sala_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala
    ADD CONSTRAINT sala_pkey PRIMARY KEY (id);


--
-- Name: seccion seccion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seccion
    ADD CONSTRAINT seccion_pkey PRIMARY KEY (id);


--
-- Name: seccion seccion_sala_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seccion
    ADD CONSTRAINT seccion_sala_id_nombre_key UNIQUE (sala_id, nombre);


--
-- Name: ix_funcion_pelicula_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_funcion_pelicula_fecha ON public.funcion USING btree (pelicula_id, fecha);


--
-- Name: ix_funcion_sala_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_funcion_sala_fecha ON public.funcion USING btree (sala_id, fecha, hora_inicio);


--
-- Name: asiento asiento_fila_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento
    ADD CONSTRAINT asiento_fila_id_fkey FOREIGN KEY (fila_id) REFERENCES public.fila(id);


--
-- Name: fila fila_seccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fila
    ADD CONSTRAINT fila_seccion_id_fkey FOREIGN KEY (seccion_id) REFERENCES public.seccion(id);


--
-- Name: funcion funcion_pelicula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcion
    ADD CONSTRAINT funcion_pelicula_id_fkey FOREIGN KEY (pelicula_id) REFERENCES public.pelicula(id);


--
-- Name: funcion funcion_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcion
    ADD CONSTRAINT funcion_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.sala(id);


--
-- Name: pelicula_imagen pelicula_imagen_pelicula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pelicula_imagen
    ADD CONSTRAINT pelicula_imagen_pelicula_id_fkey FOREIGN KEY (pelicula_id) REFERENCES public.pelicula(id) ON DELETE CASCADE;


--
-- Name: seccion seccion_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seccion
    ADD CONSTRAINT seccion_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.sala(id);


--
-- PostgreSQL database dump complete
--


