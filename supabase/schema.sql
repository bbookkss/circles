--
-- PostgreSQL database dump
--

\restrict mriF5NljdHV8rCkJvijnt29NFlfOG8k8l8zb5rQ0lHqi0kPeyIwRZwho45ZfZCt

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: can_read_circle_content(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_read_circle_content(cid uuid, uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select uid is not null
       and (public.circle_is_public(cid) or public.is_circle_member(cid, uid));
  $$;


ALTER FUNCTION public.can_read_circle_content(cid uuid, uid uuid) OWNER TO postgres;

--
-- Name: circle_is_public(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.circle_is_public(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select exists (
      select 1 from public.circles c where c.id = cid and c.visibility = 'public'
    );
  $$;


ALTER FUNCTION public.circle_is_public(cid uuid) OWNER TO postgres;

--
-- Name: circle_is_visible(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.circle_is_visible(cid uuid, uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select exists (
      select 1 from public.circles c
      where c.id = cid
        and (
          c.visibility = 'public'
          or c.created_by = uid
          or public.is_circle_member(c.id, uid)
        )
    );
  $$;


ALTER FUNCTION public.circle_is_visible(cid uuid, uid uuid) OWNER TO postgres;

--
-- Name: circle_preview(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.circle_preview(circle_id uuid) RETURNS TABLE(id uuid, name text, description text, emoji text, category text, neighborhood text, location text, visibility text, member_count bigint, creator_name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select
      c.id, c.name, c.description, c.emoji, c.category,
      c.neighborhood, c.location, c.visibility,
      (select count(*) from public.circle_members m where m.circle_id = c.id),
      (select p.full_name from public.profiles p where p.id = c.created_by)
    from public.circles c
    where c.id = circle_preview.circle_id;
  $$;


ALTER FUNCTION public.circle_preview(circle_id uuid) OWNER TO postgres;

--
-- Name: comment_circle(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.comment_circle(cmid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select p.circle_id
    from public.post_comments pc
    join public.posts p on p.id = pc.post_id
    where pc.id = cmid;
  $$;


ALTER FUNCTION public.comment_circle(cmid uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    insert into public.profiles (id, full_name, instagram)
    values (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'instagram'
    );
    return new;
  end;
  $$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: is_circle_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_circle_member(cid uuid, uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select exists (
      select 1 from public.circle_members m
      where m.circle_id = cid and m.user_id = uid
    );
  $$;


ALTER FUNCTION public.is_circle_member(cid uuid, uid uuid) OWNER TO postgres;

--
-- Name: post_circle(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_circle(pid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select circle_id from public.posts where id = pid;
  $$;


ALTER FUNCTION public.post_circle(pid uuid) OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: circle_join_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circle_join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid,
    user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.circle_join_requests OWNER TO postgres;

--
-- Name: circle_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circle_members (
    circle_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'member'::text NOT NULL
);


ALTER TABLE public.circle_members OWNER TO postgres;

--
-- Name: circle_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circle_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid,
    days_of_week integer[] NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.circle_schedules OWNER TO postgres;

--
-- Name: circles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    location text,
    category text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    latitude double precision,
    longitude double precision,
    emoji text,
    visibility text DEFAULT 'public'::text NOT NULL,
    neighborhood text,
    city text
);


ALTER TABLE public.circles OWNER TO postgres;

--
-- Name: comment_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_likes (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comment_likes OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid,
    created_by uuid,
    title text NOT NULL,
    description text,
    location text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    type text NOT NULL,
    circle_id uuid,
    post_id uuid,
    comment_id uuid,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: post_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_comments OWNER TO postgres;

--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_likes OWNER TO postgres;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    bio text,
    instagram text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: circle_join_requests circle_join_requests_circle_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_join_requests
    ADD CONSTRAINT circle_join_requests_circle_id_user_id_key UNIQUE (circle_id, user_id);


--
-- Name: circle_join_requests circle_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_join_requests
    ADD CONSTRAINT circle_join_requests_pkey PRIMARY KEY (id);


--
-- Name: circle_members circle_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_pkey PRIMARY KEY (circle_id, user_id);


--
-- Name: circle_schedules circle_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_schedules
    ADD CONSTRAINT circle_schedules_pkey PRIMARY KEY (id);


--
-- Name: circles circles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT circles_pkey PRIMARY KEY (id);


--
-- Name: comment_likes comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_pkey PRIMARY KEY (comment_id, user_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: post_comments post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: messages_pair_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX messages_pair_idx ON public.messages USING btree (sender_id, recipient_id, created_at);


--
-- Name: messages_unread_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX messages_unread_idx ON public.messages USING btree (recipient_id, read);


--
-- Name: circle_join_requests circle_join_requests_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_join_requests
    ADD CONSTRAINT circle_join_requests_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circle_join_requests circle_join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_join_requests
    ADD CONSTRAINT circle_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: circle_members circle_members_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circle_members circle_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: circle_schedules circle_schedules_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circle_schedules
    ADD CONSTRAINT circle_schedules_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circles circles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT circles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: comment_likes comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;


--
-- Name: comment_likes comment_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: events events_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: circle_join_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.circle_join_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: circle_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

--
-- Name: circle_members circle_members: anon count; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circle_members: anon count" ON public.circle_members FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.circles
  WHERE ((circles.id = circle_members.circle_id) AND (circles.visibility = 'public'::text)))));


--
-- Name: circle_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.circle_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: circle_schedules circle_schedules: anon read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circle_schedules: anon read" ON public.circle_schedules FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.circles
  WHERE ((circles.id = circle_schedules.circle_id) AND (circles.visibility = 'public'::text)))));


--
-- Name: circles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

--
-- Name: circles circles: anon read public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circles: anon read public" ON public.circles FOR SELECT TO anon USING ((visibility = 'public'::text));


--
-- Name: circles circles: auth insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circles: auth insert" ON public.circles FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: circles circles: creator delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circles: creator delete" ON public.circles FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: circles circles: creator update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circles: creator update" ON public.circles FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: circles circles: read public or own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "circles: read public or own" ON public.circles FOR SELECT USING (((visibility = 'public'::text) OR (created_by = auth.uid()) OR public.is_circle_member(id, auth.uid())));


--
-- Name: comment_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_likes comment_likes: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes: delete own" ON public.comment_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comment_likes comment_likes: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes: insert own" ON public.comment_likes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM ((public.post_comments pc
     JOIN public.posts p ON ((p.id = pc.post_id)))
     JOIN public.circle_members m ON ((m.circle_id = p.circle_id)))
  WHERE ((pc.id = comment_likes.comment_id) AND (m.user_id = auth.uid()))))));


--
-- Name: comment_likes comment_likes: read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comment_likes: read" ON public.comment_likes FOR SELECT USING (public.can_read_circle_content(public.comment_circle(comment_id), auth.uid()));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events: auth insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "events: auth insert" ON public.events FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: events events: creator delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "events: creator delete" ON public.events FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: events events: creator update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "events: creator update" ON public.events FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: events events: read public or own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "events: read public or own" ON public.events FOR SELECT USING (public.circle_is_visible(circle_id, auth.uid()));


--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: follows follows: auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows: auth read" ON public.follows FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: follows follows: own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows: own delete" ON public.follows FOR DELETE USING ((auth.uid() = follower_id));


--
-- Name: follows follows: own insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "follows: own insert" ON public.follows FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: circle_members members: auth insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members: auth insert" ON public.circle_members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: circle_members members: own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members: own delete" ON public.circle_members FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: circle_members members: read public or own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members: read public or own" ON public.circle_members FOR SELECT USING (((user_id = auth.uid()) OR public.circle_is_visible(circle_id, auth.uid())));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages: insert if mutual follow; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "messages: insert if mutual follow" ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.follows
  WHERE ((follows.follower_id = auth.uid()) AND (follows.following_id = messages.recipient_id)))) AND (EXISTS ( SELECT 1
   FROM public.follows
  WHERE ((follows.follower_id = messages.recipient_id) AND (follows.following_id = auth.uid()))))));


--
-- Name: messages messages: read own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "messages: read own" ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages: recipient update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "messages: recipient update" ON public.messages FOR UPDATE USING ((auth.uid() = recipient_id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications: actor insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications: actor insert" ON public.notifications FOR INSERT WITH CHECK ((auth.uid() = actor_id));


--
-- Name: notifications notifications: own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications: own delete" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications notifications: own read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications: own read" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications notifications: own update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications: own update" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: post_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: post_comments post_comments: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments: delete own" ON public.post_comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: post_comments post_comments: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments: insert own" ON public.post_comments FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (public.posts p
     JOIN public.circle_members m ON ((m.circle_id = p.circle_id)))
  WHERE ((p.id = post_comments.post_id) AND (m.user_id = auth.uid()))))));


--
-- Name: post_comments post_comments: read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments: read" ON public.post_comments FOR SELECT USING (public.can_read_circle_content(public.post_circle(post_id), auth.uid()));


--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes post_likes: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes: delete own" ON public.post_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: post_likes post_likes: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes: insert own" ON public.post_likes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (public.posts p
     JOIN public.circle_members m ON ((m.circle_id = p.circle_id)))
  WHERE ((p.id = post_likes.post_id) AND (m.user_id = auth.uid()))))));


--
-- Name: post_likes post_likes: read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes: read" ON public.post_likes FOR SELECT USING (public.can_read_circle_content(public.post_circle(post_id), auth.uid()));


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts: members insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts: members insert" ON public.posts FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.circle_members
  WHERE ((circle_members.circle_id = posts.circle_id) AND (circle_members.user_id = auth.uid()))))));


--
-- Name: posts posts: members read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts: members read" ON public.posts FOR SELECT USING (public.can_read_circle_content(circle_id, auth.uid()));


--
-- Name: posts posts: own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts: own delete" ON public.posts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles: own update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles: own update" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles profiles: public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles: public read" ON public.profiles FOR SELECT USING (true);


--
-- Name: circle_join_requests requests: admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "requests: admin read" ON public.circle_join_requests FOR SELECT USING ((auth.uid() IN ( SELECT circle_members.user_id
   FROM public.circle_members
  WHERE ((circle_members.circle_id = circle_join_requests.circle_id) AND (circle_members.role = 'admin'::text)))));


--
-- Name: circle_join_requests requests: admin update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "requests: admin update" ON public.circle_join_requests FOR UPDATE USING ((auth.uid() IN ( SELECT circle_members.user_id
   FROM public.circle_members
  WHERE ((circle_members.circle_id = circle_join_requests.circle_id) AND (circle_members.role = 'admin'::text)))));


--
-- Name: circle_join_requests requests: auth insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "requests: auth insert" ON public.circle_join_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: circle_join_requests requests: own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "requests: own delete" ON public.circle_join_requests FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: circle_join_requests requests: own read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "requests: own read" ON public.circle_join_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: circle_schedules schedules: creator delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "schedules: creator delete" ON public.circle_schedules FOR DELETE USING ((auth.uid() = ( SELECT circles.created_by
   FROM public.circles
  WHERE (circles.id = circle_schedules.circle_id))));


--
-- Name: circle_schedules schedules: creator insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "schedules: creator insert" ON public.circle_schedules FOR INSERT WITH CHECK ((auth.uid() = ( SELECT circles.created_by
   FROM public.circles
  WHERE (circles.id = circle_schedules.circle_id))));


--
-- Name: circle_schedules schedules: read public or own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "schedules: read public or own" ON public.circle_schedules FOR SELECT USING (public.circle_is_visible(circle_id, auth.uid()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION can_read_circle_content(cid uuid, uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.can_read_circle_content(cid uuid, uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_circle_content(cid uuid, uid uuid) TO anon;
GRANT ALL ON FUNCTION public.can_read_circle_content(cid uuid, uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_circle_content(cid uuid, uid uuid) TO service_role;


--
-- Name: FUNCTION circle_is_public(cid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.circle_is_public(cid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_is_public(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.circle_is_public(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.circle_is_public(cid uuid) TO service_role;


--
-- Name: FUNCTION circle_is_visible(cid uuid, uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.circle_is_visible(cid uuid, uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_is_visible(cid uuid, uid uuid) TO anon;
GRANT ALL ON FUNCTION public.circle_is_visible(cid uuid, uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.circle_is_visible(cid uuid, uid uuid) TO service_role;


--
-- Name: FUNCTION circle_preview(circle_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.circle_preview(circle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_preview(circle_id uuid) TO anon;
GRANT ALL ON FUNCTION public.circle_preview(circle_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.circle_preview(circle_id uuid) TO service_role;


--
-- Name: FUNCTION comment_circle(cmid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.comment_circle(cmid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.comment_circle(cmid uuid) TO anon;
GRANT ALL ON FUNCTION public.comment_circle(cmid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.comment_circle(cmid uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_circle_member(cid uuid, uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_circle_member(cid uuid, uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_circle_member(cid uuid, uid uuid) TO anon;
GRANT ALL ON FUNCTION public.is_circle_member(cid uuid, uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_circle_member(cid uuid, uid uuid) TO service_role;


--
-- Name: FUNCTION post_circle(pid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.post_circle(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_circle(pid uuid) TO anon;
GRANT ALL ON FUNCTION public.post_circle(pid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_circle(pid uuid) TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: TABLE circle_join_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.circle_join_requests TO anon;
GRANT ALL ON TABLE public.circle_join_requests TO authenticated;
GRANT ALL ON TABLE public.circle_join_requests TO service_role;


--
-- Name: TABLE circle_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.circle_members TO anon;
GRANT ALL ON TABLE public.circle_members TO authenticated;
GRANT ALL ON TABLE public.circle_members TO service_role;


--
-- Name: COLUMN circle_members.circle_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(circle_id) ON TABLE public.circle_members TO anon;


--
-- Name: TABLE circle_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.circle_schedules TO anon;
GRANT ALL ON TABLE public.circle_schedules TO authenticated;
GRANT ALL ON TABLE public.circle_schedules TO service_role;


--
-- Name: TABLE circles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.circles TO anon;
GRANT ALL ON TABLE public.circles TO authenticated;
GRANT ALL ON TABLE public.circles TO service_role;


--
-- Name: TABLE comment_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comment_likes TO anon;
GRANT ALL ON TABLE public.comment_likes TO authenticated;
GRANT ALL ON TABLE public.comment_likes TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE follows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.follows TO anon;
GRANT ALL ON TABLE public.follows TO authenticated;
GRANT ALL ON TABLE public.follows TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE post_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_comments TO anon;
GRANT ALL ON TABLE public.post_comments TO authenticated;
GRANT ALL ON TABLE public.post_comments TO service_role;


--
-- Name: TABLE post_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_likes TO anon;
GRANT ALL ON TABLE public.post_likes TO authenticated;
GRANT ALL ON TABLE public.post_likes TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.full_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(full_name) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(avatar_url) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.created_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(created_at) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.bio; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(bio) ON TABLE public.profiles TO anon;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict mriF5NljdHV8rCkJvijnt29NFlfOG8k8l8zb5rQ0lHqi0kPeyIwRZwho45ZfZCt

