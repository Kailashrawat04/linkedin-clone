(() => {
  "use strict";

  const app = document.getElementById("app");
  const state = {
    user: null, view: "feed", authMode: "login", authBusy: false, authError: "",
    posts: [], postsError: "", postsLoading: false, requests: [], requestError: "",
    connections: [], connectionsError: "", searchQuery: "", searchResults: [],
    searchError: "", searchLoading: false, profile: null, profileIsOwn: false,
    profileError: "", profileLoading: false, editingProfile: false,
    requestedProfiles: new Set(),
    expandedComments: new Set(), comments: {}, commentErrors: {}, busy: new Set(),
    toast: null, toastTimer: null, pendingSearch: null
  };

  const esc = (value = "") => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const idOf = value => String(value?._id || value?.id || value || "");
  const nameOf = value => value?.name || "Member";
  const initials = value => nameOf(value).trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "M";
  const safeUrl = value => {
    if (!value || typeof value !== "string") return "";
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  };
  const avatar = (person, size = "", imageField = "profilePicture") => {
    const image = safeUrl(person?.[imageField]);
    return `<span class="avatar ${size}" aria-label="${esc(nameOf(person))}">${esc(initials(person))}${image ? `<img data-avatar-img src="${esc(image)}" alt="" referrerpolicy="no-referrer">` : ""}</span>`;
  };
  const dateLabel = value => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  };
  const errorMessage = (body, status) => body?.message || (status === 401 ? "Your session has ended. Please sign in again." : `The service returned an error (${status}). Please try again.`);
  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
      });
    } catch {
      throw new Error("Could not reach the service. Check that the server is running, then try again.");
    }
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const error = new Error(errorMessage(body, response.status));
      error.status = response.status;
      throw error;
    }
    return body;
  }
  const json = data => JSON.stringify(data);

  function showToast(message, isError = false) {
    state.toast = { message, isError };
    clearTimeout(state.toastTimer);
    render();
    state.toastTimer = setTimeout(() => { state.toast = null; render(); }, 3600);
  }
  function render() {
    const active = document.activeElement;
    const previousView = state.view;
    const previousUser = idOf(state.user);
    const keyFor = element => element.id || element.dataset.focusKey ||
      `${element.form?.dataset.form || "field"}:${element.form?.dataset.id || ""}:${element.name || ""}`;
    const savedControls = new Map(Array.from(app.querySelectorAll("input, textarea, select")).map(element => [
      keyFor(element),
      { value: element.value, start: element.selectionStart, end: element.selectionEnd, focused: element === active }
    ]));
    app.innerHTML = state.user ? renderShell() : renderAuth();
    if (previousView === state.view && previousUser === idOf(state.user)) {
      app.querySelectorAll("input, textarea, select").forEach(element => {
        const saved = savedControls.get(keyFor(element));
        if (!saved) return;
        element.value = saved.value;
        if (saved.focused) {
          element.focus({ preventScroll: true });
          if (saved.start !== null && typeof element.setSelectionRange === "function") element.setSelectionRange(saved.start, saved.end);
        }
      });
    }
    app.querySelectorAll("[data-avatar-img]").forEach(image => image.addEventListener("error", () => image.remove()));
  }
  function renderAuth() {
    const register = state.authMode === "register";
    return `<main class="auth-screen">
      <section class="auth-story" aria-label="About Common Ground">
        <a class="brand" href="/" aria-label="Common Ground home"><span class="brand-mark">c</span><span>common ground</span></a>
        <div class="story-copy"><span class="eyebrow">A network for the work between us</span><h1>Good work<br>happens <em>together.</em></h1><p>Meet the people who make your next idea, question or opportunity feel a little closer.</p></div>
        <div class="story-foot">A thoughtful place to find your people.</div>
      </section>
      <section class="auth-panel"><form class="auth-card" data-form="auth">
        <span class="eyebrow">${register ? "Make room for good things" : "Welcome back"}</span>
        <h2>${register ? "Find your people." : "Your people are here."}</h2>
        <p>${register ? "Start with a name and an open mind." : "Sign in to pick up where you left off."}</p>
        ${state.authError ? `<div class="notice error" role="alert">${esc(state.authError)}</div>` : ""}
        ${register ? `<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required maxlength="100" placeholder="How people know you"></div>` : ""}
        <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></div>
        <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="6" required placeholder="${register ? "At least 6 characters" : "Your password"}"></div>
        <button class="primary-button auth-submit" type="submit" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Please wait…" : register ? "Create your account" : "Sign in"}</button>
        <button class="auth-switch" type="button" data-action="auth-mode">${register ? "Already have an account? Sign in" : "New here? Create an account"}</button>
      </form></section>
    </main><div class="page-grain" aria-hidden="true"></div>`;
  }
  const navItems = [
    ["feed", "Feed", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16M4 10h16M4 14.5h10M4 19h10"/></svg>'],
    ["search", "People", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4 4"/></svg>'],
    ["requests", "Requests", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18 8v6M21 11h-6"/></svg>'],
    ["connections", "Connections", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.4a4.2 4.2 0 0 1 4.2-4.2h4.6a4.2 4.2 0 0 1 4.2 4.2V20M16 5a3.5 3.5 0 0 1 0 6.7M18 14.5a4.2 4.2 0 0 1 3.5 4.1V20"/></svg>'],
    ["profile", "You", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>']
  ];
  function renderShell() {
    const displayName = esc(nameOf(state.user));
    const searchValue = esc(state.searchQuery);
    return `<div class="shell">
      <header class="topbar">
        <a class="brand" href="#" data-action="navigate" data-view="feed"><span class="brand-mark">c</span><span>common ground</span></a>
        <form class="top-search" data-form="search" role="search"><svg class="search-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><input name="q" value="${searchValue}" data-focus-key="top-search" aria-label="Search people by name or headline" placeholder="Find your people"></form>
        <nav class="top-nav" aria-label="Main navigation">${navItems.map(([view, label, icon]) => `<button type="button" class="nav-button ${state.view === view ? "active" : ""}" data-action="navigate" data-view="${view}" aria-current="${state.view === view ? "page" : "false"}">${icon}<span>${label}</span>${view === "requests" && state.requests.length ? `<span class="nav-count">${state.requests.length}</span>` : ""}</button>`).join("")}</nav>
        <button class="profile-shortcut" type="button" data-action="my-profile" aria-label="Open your profile">${avatar(state.user, "small")}<span class="shortcut-name">${displayName}</span></button>
      </header>
      <div class="layout">
        ${renderLeftRail()}
        <main class="main-column" id="main-content">${renderView()}</main>
        ${renderRightRail()}
      </div>
      ${state.toast ? `<div class="toast ${state.toast.isError ? "error" : ""}" role="status">${esc(state.toast.message)}</div>` : ""}
      <div class="page-grain" aria-hidden="true"></div>
    </div>`;
  }
  function renderLeftRail() {
    return `<aside class="left-rail" aria-label="Your profile">
      <section class="rail-card identity-card">
        <div class="identity-cover">${safeUrl(state.user.coverPicture) ? `<img src="${esc(safeUrl(state.user.coverPicture))}" alt="" data-avatar-img referrerpolicy="no-referrer">` : ""}</div>
        <div class="identity-avatar">${avatar(state.user)}</div>
        <div class="identity-info"><strong>${esc(nameOf(state.user))}</strong><p>${esc(state.user.headline || "Tell people what you do")}</p></div>
        <button class="rail-link" type="button" data-action="my-profile">View your profile <span aria-hidden="true">→</span></button>
      </section>
      <section class="rail-card rail-note"><span class="eyebrow">A small reminder</span>Good connections begin with a real conversation. Be curious. Be generous.<button class="rail-link" type="button" data-action="logout">Sign out</button></section>
    </aside>`;
  }
  function renderRightRail() {
    const preview = state.requests.slice(0, 2);
    return `<aside class="right-rail" aria-label="Community updates">
      <section class="rail-card mini-card">
        <h3>People reaching out</h3><p>${state.requestError ? "Requests could not be loaded just now." : state.requests.length ? `${state.requests.length} ${state.requests.length === 1 ? "person is" : "people are"} hoping to connect.` : "New connections start with a hello."}</p>
        ${preview.length ? `<div class="pending-preview">${preview.map(request => `<div class="pending-row">${avatar(request.requester, "small")}<div class="author-copy"><strong>${esc(nameOf(request.requester))}</strong><span>${esc(request.requester?.headline || "Open to connecting")}</span></div></div>`).join("")}</div>` : ""}
        <button class="rail-link" type="button" data-action="navigate" data-view="requests">${state.requests.length ? "Review requests" : "See your requests"} <span aria-hidden="true">→</span></button>
      </section>
      <section class="rail-card rail-note"><span class="eyebrow">Common ground</span>Work gets better when the right people can find each other.</section>
    </aside>`;
  }
  function sectionHeading(kicker, title, subtitle = "") {
    return `<div class="section-heading"><div><span class="eyebrow section-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div></div>`;
  }
  function renderView() {
    switch (state.view) {
      case "search": return renderSearch();
      case "requests": return renderRequests();
      case "connections": return renderConnections();
      case "profile": return renderProfile();
      default: return renderFeed();
    }
  }
  function renderFeed() {
    let body;
    if (state.postsLoading) body = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
    else if (state.postsError) body = errorPanel(state.postsError, "reload-feed");
    else if (!state.posts.length) body = `<section class="surface empty-state"><div class="empty-mark" aria-hidden="true">c</div><h2>A little quiet, for now.</h2><p>There are no posts in your feed yet. Say hello to someone, then come back and see what grows.</p><button class="secondary-button" type="button" data-action="navigate" data-view="search">Find people to connect with</button></section>`;
    else body = `<div class="post-list">${state.posts.map(renderPost).join("")}</div>`;
    return `${sectionHeading("The conversation", "Your feed", "Ideas, updates and useful bits from your network.")}<section class="surface composer"><div class="composer-top">${avatar(state.user)}<button class="composer-trigger" type="button" data-action="compose">Share something with your network…</button></div><div class="composer-actions"><span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>Photo link</span><span>Keep it useful. Keep it human.</span></div></section>${body}`;
  }
  function renderPost(post) {
    const author = post.author || {};
    const postId = idOf(post);
    const authorId = idOf(author);
    const userId = idOf(state.user);
    const likes = Array.isArray(post.likes) ? post.likes.length : Number(post.likesCount || 0);
    const liked = post.liked ?? (Array.isArray(post.likes) && post.likes.some(item => idOf(item) === userId));
    const image = safeUrl(post.image);
    const expanded = state.expandedComments.has(postId);
    const comments = state.comments[postId];
    const busy = state.busy.has(`like:${postId}`);
    return `<article class="surface post-card" data-post-id="${esc(postId)}">
      <header class="post-author">${avatar(author)}<div class="author-copy"><strong>${esc(nameOf(author))}</strong><span>${esc(author.headline || "Member of Common Ground")}</span></div><time class="post-meta" datetime="${esc(post.createdAt || "")}">${esc(dateLabel(post.createdAt))}</time></header>
      <p class="post-text">${esc(post.text || "")}</p>
      ${image ? `<img class="post-image" src="${esc(image)}" alt="Image shared by ${esc(nameOf(author))}" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="post-stats"><span>${likes} ${likes === 1 ? "like" : "likes"}</span>${expanded && comments ? `<span>${comments.length} ${comments.length === 1 ? "comment" : "comments"}</span>` : ""}</div>
      <div class="post-actions">
        <button class="post-action ${liked ? "liked" : ""}" type="button" data-action="like" data-id="${esc(postId)}" aria-pressed="${Boolean(liked)}" ${busy ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 8.8c0 5.4-8.4 11-8.4 11s-8.4-5.6-8.4-11a4.5 4.5 0 0 1 8.4-2.4 4.5 4.5 0 0 1 8.4 2.4Z"/></svg>${liked ? "Liked" : "Like"}</button>
        <button class="post-action" type="button" data-action="comments" data-id="${esc(postId)}" aria-expanded="${expanded}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-9.5a7.5 7.5 0 1 1 17 0Z"/></svg>${expanded ? "Hide comments" : "Comment"}</button>
        ${authorId && authorId === userId ? `<button class="post-action delete-post" type="button" data-action="delete-post" data-id="${esc(postId)}">Delete</button>` : ""}
      </div>
      ${expanded ? renderComments(postId, comments) : ""}
    </article>`;
  }
  function renderComments(postId, comments) {
    if (!comments) return `<div class="comments"><div class="skeleton" style="height:46px;border-radius:7px"></div></div>`;
    const error = state.commentErrors[postId];
    return `<div class="comments">${error ? `<div class="notice error" role="alert">${esc(error)}</div>` : ""}
      <div class="comment-list">${comments.length ? comments.map(comment => `<div class="comment-row">${avatar(comment.author, "small")}<div class="comment-bubble"><strong>${esc(nameOf(comment.author))}</strong>${esc(comment.text || "")}</div></div>`).join("") : `<span class="field-hint">No comments yet. Start the conversation.</span>`}</div>
      <form class="comment-compose" data-form="comment" data-id="${esc(postId)}"><label class="sr-only" for="comment-${esc(postId)}">Write a comment</label><input id="comment-${esc(postId)}" name="text" maxlength="1000" required placeholder="Add a thoughtful comment…" data-focus-key="comment-${esc(postId)}"><button type="submit">Reply</button></form>
    </div>`;
  }
  function renderSearch() {
    let content = "";
    if (!state.searchQuery.trim()) content = `<section class="surface empty-state"><div class="empty-mark" aria-hidden="true">↗</div><h2>Start with a name or a thought.</h2><p>Search by a person's name or the work they do. Your next useful connection could be one conversation away.</p></section>`;
    else if (state.searchLoading) content = `<div class="person-grid"><div class="surface skeleton skeleton-card"></div><div class="surface skeleton skeleton-card"></div></div>`;
    else if (state.searchError) content = errorPanel(state.searchError, "retry-search");
    else if (!state.searchResults.length) content = `<section class="surface empty-state"><div class="empty-mark" aria-hidden="true">?</div><h2>No people found.</h2><p>Try a different name or a broader description of the work you're looking for.</p></section>`;
    else content = `<div class="person-grid">${state.searchResults.map(person => `<article class="surface person-card">${avatar(person)}<strong>${esc(nameOf(person))}</strong><p>${esc(person.headline || "A member of the network")}</p><button class="secondary-button" type="button" data-action="open-person" data-id="${esc(idOf(person))}">View profile</button></article>`).join("")}</div>`;
    return `${sectionHeading("Find your people", "Meet someone new", "Search the network by name or headline.")}<section class="surface" style="padding:13px;margin-bottom:14px"><label class="field" style="margin:0"><span class="sr-only">Search people</span><input aria-label="Search people" data-focus-key="people-search" value="${esc(state.searchQuery)}" data-role="people-search" placeholder="Try a name or headline"></label></section>${content}`;
  }
  function renderRequests() {
    let content;
    if (state.requestError) content = errorPanel(state.requestError, "reload-requests");
    else if (!state.requests.length) content = `<section class="surface empty-state"><div class="empty-mark" aria-hidden="true">↔</div><h2>No pending requests.</h2><p>When someone asks to connect, you'll find them here. In the meantime, you can discover people doing interesting work.</p><button class="secondary-button" type="button" data-action="navigate" data-view="search">Explore people</button></section>`;
    else content = `<div class="surface">${state.requests.map(request => {
      const person = request.requester || {};
      return `<article class="connection-row">${avatar(person)}<div class="author-copy"><strong>${esc(nameOf(person))}</strong><span>${esc(person.headline || "Would like to connect with you")}</span></div><button class="tiny-action" type="button" data-action="respond" data-status="accepted" data-id="${esc(idOf(request))}">Accept</button><button class="tiny-action reject" type="button" data-action="respond" data-status="rejected" data-id="${esc(idOf(request))}">Decline</button></article>`;
    }).join("")}</div>`;
    return `${sectionHeading("A note from someone", "Connection requests", "Choose the conversations you'd like to make room for.")}${content}`;
  }
  function renderConnections() {
    let content;
    if (state.connectionsError) content = errorPanel(state.connectionsError, "reload-connections");
    else if (!state.connections.length) content = `<section class="surface empty-state"><div class="empty-mark" aria-hidden="true">c</div><h2>Your network starts here.</h2><p>Connections will appear as people accept your requests. Find someone whose work you'd like to know better.</p><button class="secondary-button" type="button" data-action="navigate" data-view="search">Find people</button></section>`;
    else content = `<section class="surface">${state.connections.map(person => `<article class="connection-row">${avatar(person)}<div class="author-copy"><strong>${esc(nameOf(person))}</strong><span>${esc(person.headline || "Common Ground connection")}</span></div><button type="button" class="quiet-button" data-action="open-person" data-id="${esc(idOf(person))}">Profile</button></article>`).join("")}</section>`;
    return `${sectionHeading("People in your corner", "Your connections", `${state.connections.length} ${state.connections.length === 1 ? "connection" : "connections"}`)}${content}`;
  }
  function renderProfile() {
    if (state.profileLoading) return `${sectionHeading("A little about you", "Your profile")}<div class="surface skeleton skeleton-card"></div>`;
    if (state.profileError) return `${sectionHeading("A little about you", "Your profile")}${errorPanel(state.profileError, "my-profile")}`;
    const user = state.profile || state.user;
    if (!user) return `${sectionHeading("A little about you", "Your profile")}${errorPanel("We couldn't load this profile.", "my-profile")}`;
    if (state.editingProfile && state.profileIsOwn) return `${sectionHeading("Make it yours", "Edit your profile", "Share the useful context people need to know you.")}${renderProfileForm(user)}`;
    const cover = safeUrl(user.coverPicture);
    const isOwn = state.profileIsOwn;
    return `${sectionHeading(isOwn ? "A little about you" : "Meet a member", isOwn ? "Your profile" : "Profile")}
      <article class="surface profile-surface">
        <div class="profile-cover">${cover ? `<img src="${esc(cover)}" alt="" data-avatar-img referrerpolicy="no-referrer">` : ""}</div>
        <div class="profile-head">${avatar(user, "large")}<div class="profile-title"><h1>${esc(nameOf(user))}</h1><p>${esc(user.headline || "A member of Common Ground")}</p>${user.location ? `<div class="profile-location">${esc(user.location)}</div>` : ""}</div>${isOwn ? `<div class="profile-head-actions"><button class="secondary-button" type="button" data-action="edit-profile">Edit profile</button><button class="quiet-button" type="button" data-action="logout">Sign out</button></div>` : ""}</div>
      </article>
      <div class="profile-body">
        ${!isOwn ? `<section class="surface profile-section"><button type="button" class="primary-button" data-action="connect" data-id="${esc(idOf(user))}" ${state.requestedProfiles.has(idOf(user)) || state.connections.some(person => idOf(person) === idOf(user)) ? "disabled" : ""}>${state.connections.some(person => idOf(person) === idOf(user)) ? "Connected" : state.requestedProfiles.has(idOf(user)) ? "Request sent" : "Connect"}</button></section>` : ""}
        ${user.bio ? `<section class="surface profile-section"><h2>About</h2><p>${esc(user.bio)}</p></section>` : isOwn ? `<section class="surface profile-section"><h2>About</h2><p>Your story goes here. Add a short bio so people know what matters to you.</p></section>` : ""}
        ${Array.isArray(user.experience) && user.experience.length ? `<section class="surface profile-section"><h2>Experience</h2>${user.experience.map(item => `<div class="timeline-item"><strong>${esc(item.title || "Role")}${item.company ? ` · ${esc(item.company)}` : ""}</strong><span>${esc(formatPeriod(item.startDate, item.endDate))}</span>${item.description ? `<p>${esc(item.description)}</p>` : ""}</div>`).join("")}</section>` : ""}
        ${Array.isArray(user.education) && user.education.length ? `<section class="surface profile-section"><h2>Education</h2>${user.education.map(item => `<div class="timeline-item"><strong>${esc(item.school || "School")}</strong><span>${esc([item.degree, item.startYear, item.endYear].filter(Boolean).join(" · "))}</span></div>`).join("")}</section>` : ""}
        ${Array.isArray(user.skills) && user.skills.length ? `<section class="surface profile-section"><h2>Skills &amp; interests</h2><div class="skill-list">${user.skills.map(skill => `<span class="skill-chip">${esc(skill)}</span>`).join("")}</div></section>` : ""}
      </div>`;
  }
  function formatPeriod(start, end) {
    const label = date => {
      if (!date) return "";
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    };
    const startLabel = label(start);
    const endLabel = label(end);
    return startLabel ? `${startLabel} — ${endLabel || "Present"}` : endLabel;
  }
  function renderProfileForm(user) {
    return `<form class="surface profile-form" data-form="profile">
      <h2>Give people a little context.</h2><p>Only add what feels useful. Image fields accept a public http or https URL. Experience and education use JSON arrays, matching your profile data.</p>
      <div class="form-grid">
        <div class="field"><label for="profile-name">Name</label><input id="profile-name" name="name" value="${esc(user.name || "")}" maxlength="100" required></div>
        <div class="field"><label for="profile-location">Location</label><input id="profile-location" name="location" value="${esc(user.location || "")}" maxlength="120" placeholder="City or region"></div>
        <div class="field wide"><label for="profile-headline">Headline</label><input id="profile-headline" name="headline" value="${esc(user.headline || "")}" maxlength="180" placeholder="The work you do and what you care about"></div>
        <div class="field wide"><label for="profile-bio">About</label><textarea id="profile-bio" name="bio" maxlength="2000" placeholder="A few words about your work, interests or approach">${esc(user.bio || "")}</textarea></div>
        <div class="field"><label for="profile-picture">Profile picture URL</label><input id="profile-picture" name="profilePicture" type="url" value="${esc(user.profilePicture || "")}" placeholder="https://…"></div>
        <div class="field"><label for="cover-picture">Cover picture URL</label><input id="cover-picture" name="coverPicture" type="url" value="${esc(user.coverPicture || "")}" placeholder="https://…"></div>
        <div class="field wide"><label for="profile-skills">Skills and interests</label><input id="profile-skills" name="skills" value="${esc(Array.isArray(user.skills) ? user.skills.join(", ") : "")}" placeholder="Research, facilitation, product design"></div>
        <div class="field wide"><label for="profile-experience">Experience (JSON array)</label><textarea id="profile-experience" name="experience" spellcheck="false">${esc(JSON.stringify(Array.isArray(user.experience) ? user.experience : [], null, 2))}</textarea><span class="field-hint">Each item can include title, company, startDate, endDate and description.</span></div>
        <div class="field wide"><label for="profile-education">Education (JSON array)</label><textarea id="profile-education" name="education" spellcheck="false">${esc(JSON.stringify(Array.isArray(user.education) ? user.education : [], null, 2))}</textarea><span class="field-hint">Each item can include school, degree, startYear and endYear.</span></div>
      </div>
      <div class="form-actions"><button class="primary-button" type="submit">Save profile</button><button class="quiet-button" type="button" data-action="cancel-profile-edit">Cancel</button></div>
    </form>`;
  }
  function errorPanel(message, action) {
    return `<div class="inline-error" role="alert">${esc(message)}<button type="button" data-action="${esc(action)}">Try again</button></div>`;
  }
  function composerDialog() {
    const existing = document.getElementById("composer-dialog");
    if (existing) { existing.remove(); return; }
    const dialog = document.createElement("dialog");
    dialog.id = "composer-dialog";
    dialog.className = "compose-dialog";
    dialog.innerHTML = `<form class="compose-card" data-form="post">
      <div class="compose-header"><div><span class="eyebrow section-kicker">The conversation</span><h2>Share something useful.</h2></div><button type="button" class="quiet-button" data-action="close-compose" aria-label="Close">Close</button></div>
      <p class="field-hint">A thought, an update or a question. Good conversations start anywhere.</p>
      <label class="sr-only" for="new-post-text">Your post</label><textarea id="new-post-text" name="text" required maxlength="3000" placeholder="What's on your mind?"></textarea>
      <div class="field"><label for="new-post-image">Image URL <span class="field-hint">(optional)</span></label><input id="new-post-image" type="url" name="image" placeholder="https://…"></div>
      <div class="form-actions"><button class="primary-button" type="submit">Share post</button><button class="quiet-button" type="button" data-action="close-compose">Not now</button></div>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    dialog.querySelector("textarea").focus();
  }
  async function loadHome() {
    state.postsLoading = true; state.postsError = ""; state.requestError = ""; state.connectionsError = "";
    render();
    const [posts, requests, connections] = await Promise.allSettled([
      api("/api/posts?page=1"), api("/api/connections/pending"), api("/api/connections/")
    ]);
    if (posts.status === "fulfilled") state.posts = Array.isArray(posts.value) ? posts.value : [];
    else state.postsError = posts.reason.message;
    if (requests.status === "fulfilled") state.requests = Array.isArray(requests.value) ? requests.value : [];
    else state.requestError = requests.reason.message;
    if (connections.status === "fulfilled") state.connections = Array.isArray(connections.value) ? connections.value : [];
    else state.connectionsError = connections.reason.message;
    state.postsLoading = false;
    render();
  }
  async function openOwnProfile() {
    state.profile = state.user; state.profileIsOwn = true; state.profileError = ""; state.editingProfile = false; state.view = "profile";
    render();
    try {
      const response = await api("/api/auth/me");
      state.profile = response?.user || state.user;
      state.user = state.profile;
    } catch (error) {
      state.profileError = error.message;
    }
    render();
  }
  async function openPerson(id) {
    if (!id) return;
    if (id === idOf(state.user)) { await openOwnProfile(); return; }
    state.profileLoading = true; state.profile = null; state.profileError = ""; state.profileIsOwn = false;
    state.editingProfile = false; state.view = "profile"; render();
    try { state.profile = await api(`/api/users/${encodeURIComponent(id)}`); }
    catch (error) { state.profileError = error.message; }
    state.profileLoading = false; render();
  }
  async function runSearch(query) {
    const clean = query.trim();
    if (!clean) {
      state.searchResults = []; state.searchError = ""; state.searchLoading = false; render(); return;
    }
    state.searchLoading = true; state.searchError = ""; render();
    try {
      const results = await api(`/api/users/search?q=${encodeURIComponent(clean)}`);
      if (state.searchQuery.trim() === clean) state.searchResults = Array.isArray(results) ? results : [];
    } catch (error) {
      if (state.searchQuery.trim() === clean) state.searchError = error.message;
    }
    if (state.searchQuery.trim() === clean) state.searchLoading = false;
    render();
  }
  async function refreshList(which) {
    try {
      if (which === "feed") { state.postsLoading = true; state.postsError = ""; render(); const posts = await api("/api/posts?page=1"); state.posts = Array.isArray(posts) ? posts : []; state.postsLoading = false; }
      if (which === "requests") { state.requestError = ""; const rows = await api("/api/connections/pending"); state.requests = Array.isArray(rows) ? rows : []; }
      if (which === "connections") { state.connectionsError = ""; const rows = await api("/api/connections/"); state.connections = Array.isArray(rows) ? rows : []; }
      render();
    } catch (error) {
      if (which === "feed") { state.postsLoading = false; state.postsError = error.message; }
      if (which === "requests") state.requestError = error.message;
      if (which === "connections") state.connectionsError = error.message;
      render();
    }
  }
  function navigate(view) {
    state.view = view;
    if (view === "profile") return openOwnProfile();
    if (view === "search") {
      state.searchQuery = ""; state.searchResults = []; state.searchError = ""; state.searchLoading = false;
    }
    render();
  }

  app.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === "auth-mode") { state.authMode = state.authMode === "login" ? "register" : "login"; state.authError = ""; render(); return; }
    if (action === "navigate") { event.preventDefault(); navigate(button.dataset.view || "feed"); return; }
    if (action === "my-profile") { await openOwnProfile(); return; }
    if (action === "compose") { composerDialog(); return; }
    if (action === "close-compose") { document.getElementById("composer-dialog")?.close(); return; }
    if (action === "edit-profile") { state.editingProfile = true; render(); return; }
    if (action === "cancel-profile-edit") { state.editingProfile = false; render(); return; }
    if (action === "open-person") { await openPerson(button.dataset.id); return; }
    if (action === "reload-feed") { await refreshList("feed"); return; }
    if (action === "reload-requests") { await refreshList("requests"); return; }
    if (action === "reload-connections") { await refreshList("connections"); return; }
    if (action === "retry-search") { await runSearch(state.searchQuery); return; }
    if (action === "logout") {
      button.disabled = true;
      try {
        await api("/api/auth/logout", { method: "POST", body: json({}) });
        state.user = null; state.posts = []; state.requests = []; state.connections = [];
        state.requestedProfiles = new Set(); state.profile = null; state.toast = null;
        state.view = "feed"; state.authMode = "login"; state.authError = "";
        render();
      } catch (error) { button.disabled = false; showToast(error.message, true); }
      return;
    }
    if (action === "connect") {
      if (!id || state.requestedProfiles.has(id)) return;
      button.disabled = true;
      try {
        await api("/api/connections/request", { method: "POST", body: json({ recipientId: id }) });
        state.requestedProfiles.add(id);
        showToast("Connection request sent.");
      } catch (error) { button.disabled = false; showToast(error.message, true); }
      return;
    }
    if (action === "like") {
      if (state.busy.has(`like:${id}`)) return;
      state.busy.add(`like:${id}`); render();
      try {
        const result = await api(`/api/posts/${encodeURIComponent(id)}/like`, { method: "PUT" });
        state.posts = state.posts.map(post => idOf(post) === id ? { ...post, likesCount: result.likesCount, liked: result.liked } : post);
      } catch (error) { showToast(error.message, true); }
      state.busy.delete(`like:${id}`); render(); return;
    }
    if (action === "comments") {
      if (state.expandedComments.has(id)) { state.expandedComments.delete(id); render(); return; }
      state.expandedComments.add(id); render();
      try {
        const comments = await api(`/api/posts/${encodeURIComponent(id)}/comments`);
        state.comments[id] = Array.isArray(comments) ? comments : [];
      } catch (error) { state.commentErrors[id] = error.message; }
      render(); return;
    }
    if (action === "delete-post") {
      if (!window.confirm("Delete this post and its comments? This cannot be undone.")) return;
      try { await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" }); state.posts = state.posts.filter(post => idOf(post) !== id); showToast("Post deleted."); }
      catch (error) { showToast(error.message, true); }
      return;
    }
    if (action === "respond") {
      const status = button.dataset.status;
      button.disabled = true;
      try {
        await api(`/api/connections/request/${encodeURIComponent(id)}`, { method: "PUT", body: json({ status }) });
        state.requests = state.requests.filter(request => idOf(request) !== id);
        if (status === "accepted") {
          try { state.connections = await api("/api/connections/"); } catch { /* The accepted request is still confirmed; retry is available in the connections view. */ }
          showToast("Connection accepted.");
        } else showToast("Request declined.");
        render();
      } catch (error) { button.disabled = false; showToast(error.message, true); }
      return;
    }
  });
  app.addEventListener("input", event => {
    const input = event.target;
    if (input.dataset.role === "people-search") {
      state.searchQuery = input.value;
      clearTimeout(state.pendingSearch);
      state.pendingSearch = setTimeout(() => runSearch(state.searchQuery), 280);
    }
    if (input.name === "q" && input.form?.dataset.form === "search") {
      state.searchQuery = input.value;
      clearTimeout(state.pendingSearch);
      state.pendingSearch = setTimeout(() => {
        if (state.view !== "search") { state.view = "search"; render(); }
        runSearch(state.searchQuery);
      }, 280);
    }
  });
  app.addEventListener("submit", async event => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const action = form.dataset.form;
    if (action === "auth") {
      state.authBusy = true; state.authError = ""; render();
      const payload = state.authMode === "register"
        ? { name: String(data.get("name") || "").trim(), email: String(data.get("email") || "").trim(), password: String(data.get("password") || "") }
        : { email: String(data.get("email") || "").trim(), password: String(data.get("password") || "") };
      try {
        const response = await api(`/api/auth/${state.authMode}`, { method: "POST", body: json(payload) });
        state.user = response.user;
        state.view = "feed";
        await loadHome();
      } catch (error) { state.authError = error.message; }
      state.authBusy = false; render(); return;
    }
    if (action === "search") {
      state.searchQuery = String(data.get("q") || "").trim(); state.view = "search"; render(); await runSearch(state.searchQuery); return;
    }
    if (action === "post") {
      const text = String(data.get("text") || "").trim();
      const image = String(data.get("image") || "").trim();
      if (!text) return;
      if (image && !safeUrl(image)) { showToast("Use a valid public http or https image URL.", true); return; }
      const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
      try {
        const post = await api("/api/posts", { method: "POST", body: json({ text, ...(image ? { image } : {}) }) });
        state.posts = [post, ...state.posts]; state.postsError = "";
        document.getElementById("composer-dialog")?.close();
        showToast("Your post is out in the world.");
      } catch (error) { showToast(error.message, true); if (submit) submit.disabled = false; }
      return;
    }
    if (action === "comment") {
      const postId = form.dataset.id;
      const text = String(data.get("text") || "").trim();
      if (!text) return;
      const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
      try {
        const comment = await api(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: json({ text }) });
        state.comments[postId] = [...(state.comments[postId] || []), comment];
        state.commentErrors[postId] = "";
        render();
      } catch (error) { state.commentErrors[postId] = error.message; showToast(error.message, true); if (submit) submit.disabled = false; }
      return;
    }
    if (action === "profile") {
      const updates = {};
      for (const field of ["name", "headline", "bio", "location"]) updates[field] = String(data.get(field) || "").trim();
      const picture = String(data.get("profilePicture") || "").trim();
      const cover = String(data.get("coverPicture") || "").trim();
      if (picture && !safeUrl(picture) || cover && !safeUrl(cover)) { showToast("Profile and cover pictures must use a valid http or https URL.", true); return; }
      updates.profilePicture = picture;
      updates.coverPicture = cover;
      updates.skills = String(data.get("skills") || "").split(",").map(skill => skill.trim()).filter(Boolean);
      try {
        updates.experience = JSON.parse(String(data.get("experience") || "[]"));
        updates.education = JSON.parse(String(data.get("education") || "[]"));
        if (!Array.isArray(updates.experience) || !Array.isArray(updates.education)) throw new Error("Experience and education must each be JSON arrays.");
      } catch (error) {
        showToast(error instanceof SyntaxError ? "Check the experience and education JSON, then try again." : error.message, true); return;
      }
      const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
      try {
        const updated = await api("/api/users/profile", { method: "PUT", body: json(updates) });
        state.user = updated; state.profile = updated; state.editingProfile = false;
        showToast("Profile saved.");
      } catch (error) { showToast(error.message, true); if (submit) submit.disabled = false; return; }
      render();
    }
  });

  async function start() {
    render();
    try {
      const response = await api("/api/auth/me");
      state.user = response?.user || null;
      if (state.user) await loadHome();
      else render();
    } catch (error) {
      state.user = null;
      if (error.status !== 401) state.authError = error.message;
      render();
    }
  }

  const utilityStyle = document.createElement("style");
  utilityStyle.textContent = `.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.compose-dialog{width:min(540px,calc(100% - 28px));max-width:none;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);box-shadow:0 24px 80px rgba(35,51,43,.24)}.compose-dialog::backdrop{background:rgba(31,44,37,.44);backdrop-filter:blur(3px)}.compose-card{padding:23px}.compose-header{display:flex;justify-content:space-between;gap:14px;align-items:start}.compose-header h2{font:400 30px var(--display);letter-spacing:-.03em;margin:5px 0 8px}.compose-card>textarea{width:100%;min-height:170px;resize:vertical;padding:13px;border:1px solid var(--line);border-radius:7px;background:#fffefa;color:var(--ink);margin:15px 0 4px;line-height:1.6}.compose-card .field{margin-bottom:6px}@media(max-width:700px){.compose-card{padding:18px}.compose-card>textarea{min-height:135px}}`;
  document.head.appendChild(utilityStyle);
  start();
})();