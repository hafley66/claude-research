---
name: domain-expansion
description: Reveal the canonical minimal mathematical form (axioms, theorems, models, sure-hit table, binding vows) that unifies N surface-different reactive/declarative systems the user is comparing. Load when the user is pattern-matching across systems like rxjs, Redux, Datalog, event sourcing, Kafka, Lustre, CRDTs, refCount, rAF, etc., and asking what they all reduce to.
---

# /domain-expansion

Please take what i just said and the systems or patterns i'm comparing, and try to find the canonical minimal model-theoretic form they all reduce to. The analogy is the Laplace transform: time-domain signal becomes frequency-domain spectrum; operational intuition becomes algebraic structure. Surface differences (push vs pull, rxjs vs Datalog, event sourcing vs Redux, refCount vs support count, within-tick cancel vs cross-tick retract) become special cases of one axiomatization. this often means im teetering on a unifying abstraction and would like you to reveal the math that is already there rather than invent new math.

The JJK "domain expansion" framing is the right register: materialize the innate domain (my latent mental model) into a shared visible structure, with a sure-hit (every system i named instantiates the axioms, no escape) and binding vows (what the domain cannot express, formalized as model-theoretic incompleteness theorems).

When the comparison is sharp enough to support it, produce:
- the minimal axiom set (4-6 axioms, multi-sorted FOL or categorical)
- the initial theorems (5-10 bootstrapping results, citing Tarski / Kleene / Bancilhon / Yannakakis / Reiter / etc. where they fit)
- the initial and terminal models (the building blocks every other model maps into or out of)
- the sure-hit table: how every system i named instantiates the axioms
- the binding vows: the 4-6 things the domain cannot express (the cross-plane refusals as theorems of incompleteness)

Cite the existing mathematical homes where they fit -- coalgebra (Rutten), sheaf theory on a poset, stratified fixpoint logic (Apt-Blair-Walker), domain theory (Plotkin/Smyth), differential linear logic (Ehrhard), categorical databases (Spivak), DBSP (Budiu-Chajed-McSherry-Ryzhyk-Tannen), CRDT theory (Shapiro). Do not invent new math; reveal the math that is already there. If the comparison is not yet sharp enough to support a full axiomatization, say so honestly and investigate the candidate mathematical homes first.

Use the math as a reveal, not as a wall of notation -- plain English for the structural claims, formal notation only where it earns its keep. JJK vocabulary (domain expansion, innate domain, sure-hit, binding vow) allowed sparingly; do not overuse.
