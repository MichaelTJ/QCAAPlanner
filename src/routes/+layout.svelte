<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<header>
		<a href="/">Faculty Planning</a>
		<nav>
			<a href="/" class:active={$page.url.pathname === '/'}>Overview</a>
			<a href="/export" class:active={$page.url.pathname.startsWith('/export')}>Export</a>
			<a href="/unit-wizard" class:active={$page.url.pathname.startsWith('/unit-wizard')}>Unit wizard</a>
			<a href="/settings" class:active={$page.url.pathname === '/settings'}>Settings</a>
		</nav>
	</header>
	<main>{@render children()}</main>
</div>
