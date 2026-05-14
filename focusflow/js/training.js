/**
 * Training — personal training portal embedded in Focus Flow.
 * Data syncs to Firebase via Storage.getTrainingData / saveTrainingData.
 */

const Training = (() => {

  /* ══════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════ */
  let currentProgramId = null;


  /* ══════════════════════════════════════════════
     DEFAULT PROGRAM — Software Development
  ══════════════════════════════════════════════ */
  function buildDefaultProgram() {
    return {
      id: 'software_dev',
      title: 'Software Development Training',
      description: 'Web development, Firebase, GitHub, hosting, and your real projects.',
      createdAt: new Date().toISOString(),
      checks: {},
      notes: {},
      weeklyChecks: {},
      sections: [
        {
          id: 's1',
          title: 'How the Internet Actually Works',
          goal: 'Understand what happens when someone types your domain into a browser.',
          content: 'When someone visits a site like stephrawlingscreations.ie, the browser has to find where that website lives.',
          bullets: [
            'Domain: the web address people type.',
            'DNS: the internet phonebook — it translates the domain name to an IP address.',
            'Hosting: where the website files actually live on a server.',
            'Browser: downloads those files and builds the page using HTML, CSS, and JavaScript.'
          ],
          extra: "Your domain points to a host. The host sends your website files. The visitor's browser displays them."
        },
        {
          id: 's2',
          title: 'Static Websites vs Web Apps',
          goal: 'Know why your projects do not all run the same way.',
          content: 'A static website is mostly files — it looks the same for every visitor. A web app has moving parts like logins, databases, and user-specific data.',
          bullets: [
            'Static site: business site, landing page, portfolio, simple tools.',
            'Web app: tracker, portal, dashboard, booking system.',
            'Your string art designer is closer to a static/browser-based app.',
            'Your sales trackers and Lakeside portal are more like web apps — they need data and logins.'
          ]
        },
        {
          id: 's3',
          title: 'Frontend, Backend and Database',
          goal: 'Understand the three main layers of most apps.',
          content: 'Most modern apps have three layers that work together.',
          bullets: [
            'Frontend: what the user sees in their browser.',
            'Backend: logic, rules, processing — runs on a server.',
            'Database: where information is stored and retrieved.'
          ],
          code: 'Browser (Frontend)\n       |\nBackend / Cloud Services\n       |\nDatabase'
        },
        {
          id: 's4',
          title: 'What Firebase Actually Is',
          goal: 'Understand why Firebase feels like lots of things at once.',
          content: "Firebase is Google's cloud development platform. It bundles together the backend services most apps need, so you don't have to set up a traditional server.",
          bullets: [
            'Firebase Hosting: serves your website or app files.',
            'Firestore / Realtime Database: stores your app data.',
            'Firebase Auth: ready-made login system (email, Google, etc.).',
            'Storage: for user-uploaded files and images.',
            'Security Rules: control who can read or write data.'
          ]
        },
        {
          id: 's5',
          title: 'GitHub and Version Control',
          goal: 'Understand GitHub as your project history and safety net.',
          content: 'GitHub stores your code online and tracks every change. Each commit is a labelled checkpoint you can return to if something goes wrong.',
          bullets: [
            'Repository (repo): your project folder stored online.',
            'Commit: a saved checkpoint with a description of what changed.',
            'Push: upload your local changes to GitHub.',
            'Pull: download the latest version from GitHub.',
            'Branch: a separate copy for testing new features safely.'
          ]
        },
        {
          id: 's6',
          title: 'Hosting Types',
          goal: 'Know what to use for different kinds of projects.',
          bullets: [
            'Netlify / GitHub Pages / Vercel: great for static websites and frontend apps.',
            'Firebase Hosting: best when you also use Firestore and Firebase Auth.',
            'Wix: easy drag-and-drop builder, less flexible for custom code.',
            'Traditional server (VPS): powerful but more advanced — not needed for your current projects.'
          ]
        },
        {
          id: 's7',
          title: 'Deployment',
          goal: 'Understand how changes go live.',
          content: 'Deployment means publishing your latest version so users can see it. Some hosts auto-deploy whenever you push to GitHub.',
          code: 'VS Code (edit code)\n       |\nGitHub (save & version)\n       |\nNetlify / Firebase (publish)\n       |\nLive Website'
        },
        {
          id: 's8',
          title: 'Development, Staging and Production',
          goal: 'Avoid breaking live apps while learning.',
          content: 'Professional developers work across multiple environments to reduce risk.',
          bullets: [
            'Development: your local or private testing version — only you can see it.',
            'Staging: a test version that mirrors the live site — good for final checks.',
            'Production: the actual live site that real users see.'
          ],
          extra: 'The rule of thumb: never experiment directly on the live app if you can avoid it.'
        },
        {
          id: 's9',
          title: 'Database Thinking',
          goal: 'Learn to think like an app designer.',
          content: 'Instead of just thinking "I need a form", start thinking about what data the form creates and how it will be stored.',
          code: 'Customer\n  |-- Name\n  |-- Email\n  |-- Phone\n  |-- Jobs[]\n  |   |-- Description\n  |   |-- Date\n  |   +-- Status\n  +-- Notes',
          extra: 'This kind of thinking helps you design better trackers, portals, and dashboards from the start.'
        },
        {
          id: 's10',
          title: 'Authentication and Permissions',
          goal: 'Understand logins and access control.',
          content: 'Authentication identifies who the user is. Permissions decide what they are allowed to do.',
          bullets: [
            'Admin users: see and edit everything.',
            'Staff users: see only assigned jobs or their own area.',
            'Customers: see only their own records and history.'
          ],
          extra: 'Getting permissions right is especially important for business portals and multi-user systems.'
        },
        {
          id: 's11',
          title: 'Firebase Security Rules',
          goal: 'Know why database rules matter.',
          content: 'Firebase security rules control who can read, write, or update data in your database and Storage.',
          bullets: [
            'Rules are written in a special Firebase syntax and deployed separately.',
            'A common beginner mistake: leaving the database fully open to everyone.',
            'For any app with customer or business data, rules are not optional.',
            'You can test rules in the Firebase console before deploying them.'
          ]
        },
        {
          id: 's12',
          title: 'APIs Explained Simply',
          goal: 'Understand how software talks to software.',
          content: 'An API (Application Programming Interface) is a controlled, structured way for one system to communicate with another.',
          code: 'Frontend\n   | (makes a request)\nAPI\n   | (fetches/saves data)\nBackend / Database\n   | (returns a response)\nFrontend (updates the page)',
          extra: "Think of an API like a waiter between you and the kitchen. You don't go in yourself — you order through a clear process."
        },
        {
          id: 's13',
          title: 'Your String Art Site Architecture',
          goal: 'Understand your own site as a real software system.',
          content: 'Your string art designer mostly runs entirely in the browser — no server needed for the core features.',
          bullets: [
            'User opens the site.',
            'JavaScript downloads and runs.',
            'Canvas element draws the string art design.',
            'Export / PDF logic also runs in the browser.',
            'Static hosting (like Netlify) works well for this kind of app.'
          ]
        },
        {
          id: 's14',
          title: 'Your Lakeside Portal Architecture',
          goal: 'Understand why the portal is more complex than a normal website.',
          content: 'The Lakeside portal is more like a SaaS-style web app. It needs persistent data, user accounts, and access control.',
          code: 'Browser (Dashboard)\n       |\nFirebase Auth (who is this user?)\n       |\nFirestore (Job / Quote / Invoice data)\n       |\nSecurity Rules (what can they see?)',
          bullets: [
            'Users log in with Firebase Auth.',
            'Jobs and quotes are stored in Firestore.',
            'Different roles (admin, staff, client) need different permissions.',
            'Data can update in real time without a page refresh.'
          ]
        },
        {
          id: 's15',
          title: 'SaaS Basics',
          goal: 'Understand the business model behind portals and online tools.',
          content: 'SaaS stands for Software as a Service. Instead of buying software once, users access it online — usually on a subscription.',
          bullets: [
            'Examples: Canva, Gmail, Trello, Monday.com, QuickBooks.',
            'Key features: login, user data, always up to date, accessible anywhere.',
            'Your portals and trackers are moving in this direction.'
          ]
        },
        {
          id: 's16',
          title: 'Project Organisation',
          goal: 'Stop projects becoming chaotic as they grow.',
          content: 'As a project grows, good folder structure and clear file names become important for staying in control.',
          code: 'project/\n  |-- frontend/\n  |-- backend/\n  |-- assets/\n  |-- docs/\n  |-- config/\n  +-- tests/',
          extra: 'Even small projects benefit from clear names and at least a basic README explaining what it does.'
        },
        {
          id: 's17',
          title: 'Debugging Basics',
          goal: 'Learn how to calmly find what is broken.',
          content: "Debugging is a skill — it gets easier with practice. Good developers are not people who never break things. They're people who know how to find out what went wrong.",
          bullets: [
            '1. Reproduce the issue — can you make it happen reliably?',
            '2. Check browser console errors (F12 in most browsers).',
            '3. Look at recent changes — what did you just edit?',
            '4. Test one fix at a time.',
            '5. Commit once fixed, so you have a clean checkpoint.'
          ]
        },
        {
          id: 's18',
          title: 'Managing Live Apps',
          goal: 'Know what needs checking after launch.',
          content: 'Once an app is live, it needs occasional care to stay healthy and secure.',
          bullets: [
            'Backups: make sure important data is backed up.',
            'Security rules: review and tighten periodically.',
            'Login issues: have a plan if users get locked out.',
            'Error logs: Firebase and Netlify both have logs to check.',
            'Storage usage: watch for unexpected growth.',
            'Hosting costs: check billing alerts are set.',
            'Domain renewals: set a calendar reminder before expiry.'
          ]
        },
        {
          id: 's19',
          title: 'GDPR and Data Responsibility',
          goal: 'Be aware of data protection basics for Irish and EU projects.',
          content: "If you store customer or staff data, GDPR applies. This is about treating people's information with care.",
          bullets: [
            'Only collect data you actually need.',
            'Protect access properly — use authentication and security rules.',
            'Keep backups secure and not publicly accessible.',
            'Know who can view or edit each type of record.',
            'Have a process if someone asks what data you hold about them.'
          ]
        },
        {
          id: 's20',
          title: 'React, Node.js and Next Steps',
          goal: 'Know what to learn next without feeling overwhelmed.',
          content: 'There is always more to learn in software development. The key is to build skills in the order most useful for your actual projects.',
          bullets: [
            'React: helps build better, more organised frontends for complex UIs.',
            'Node.js: runs JavaScript on a server — useful for custom backend logic.',
            'APIs: knowing how to use and build APIs opens up a lot.',
            'Architecture: planning before building saves a lot of rework.'
          ],
          extra: "You don't need to rush. Focus on: GitHub workflow, Firebase basics, database structure thinking, and safe deployment habits."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     RECOMMENDED LEARNING PATH — Phase 1
  ══════════════════════════════════════════════ */
  function buildPhase1Program() {
    return {
      id: 'recommended_phase1',
      title: 'Recommended Path — Phase 1: Core Foundations',
      description: 'Git, Firebase, hosting, and JavaScript. The most important skills for your projects right now.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'p1s1',
          title: 'Git & GitHub',
          goal: 'The single biggest confidence boost you can get right now.',
          content: 'Right now GitHub probably feels like "push code and hope". Once Git clicks, deployments make sense, backups make sense, branches make sense, and experimenting becomes much safer.',
          bullets: [
            'What to learn: commit, push, pull, branch, merge.',
            'Why it matters for you: every project you build lives in GitHub.',
            'Deployments to Netlify and Firebase connect directly to GitHub.',
            'Branches let you try things without breaking your live version.',
            'Recommended resource: Git & GitHub Crash Course by Traversy Media (search YouTube — free, very beginner friendly).',
            'Also useful: the Git sections inside The Odin Project (free, highly respected).'
          ],
          extra: 'Do this first. Everything else builds on it.'
        },
        {
          id: 'p1s2',
          title: 'Firebase',
          goal: 'Directly relevant to your sales trackers, Lakeside portal, logins, and cloud data.',
          content: 'Most Firebase tutorials are awful because they assume too much. Focus only on the four things that matter for your projects.',
          bullets: [
            'Auth: how logins work — email/password and Google sign-in.',
            'Firestore: how data is stored, read, written, and structured.',
            'Hosting: how to publish a site from Firebase.',
            'Rules: who is allowed to read or write what data.',
            'Recommended resource: Firebase Official Learn platform — firebase.google.com/learn.',
            'Also good: Firebase Full Course by freeCodeCamp on YouTube.',
            "Don't try to memorise everything. Build something small as you go."
          ],
          extra: 'You already use Firebase. This will help you understand what you have built and why it works.'
        },
        {
          id: 'p1s3',
          title: 'Hosting & Deployment',
          goal: 'Understand how your code goes from your computer to a live website.',
          content: 'Deployment is one of those things that feels magical until you understand it — then it becomes routine and reliable.',
          bullets: [
            'Netlify: connect your GitHub repo and it auto-deploys on every push.',
            'Firebase Hosting: best when your app also uses Firestore and Auth.',
            'Custom domains: how to point your domain name at your hosting.',
            'Environment variables: keeping secrets (like API keys) out of your code.',
            'Recommended: The Odin Project — Foundations section covers this well.',
            'Practice: deploy one of your existing projects from scratch to Netlify.'
          ],
          extra: 'Once you have done this once deliberately, it stops being scary.'
        },
        {
          id: 'p1s4',
          title: 'JavaScript Properly',
          goal: 'Understand the language that powers almost all of your projects.',
          content: "You already use JavaScript without fully understanding it yet. That's actually fine as a starting point. Now it's time to fill the gaps so the code you write makes more sense to you.",
          bullets: [
            'Focus on: variables, functions, arrays, objects, events, and async basics.',
            'You do NOT need to master everything — just the parts you use.',
            'Recommended resource: JavaScript.info — genuinely one of the best free resources online.',
            'Read slowly. Try the examples. Do not rush.',
            'The Odin Project also has a good JavaScript foundations section.',
            'Tip: when you see a piece of code you do not understand, paste it into Claude or ChatGPT and ask it to explain line by line.'
          ],
          extra: "Don't try to do a full JavaScript course start to finish. Use it alongside building — look things up as you need them."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     RECOMMENDED LEARNING PATH — Phase 2
  ══════════════════════════════════════════════ */
  function buildPhase2Program() {
    return {
      id: 'recommended_phase2',
      title: 'Recommended Path — Phase 2: Data & Architecture',
      description: 'Database design, APIs, and system architecture. The thinking skills that separate hobby coders from app designers.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'p2s1',
          title: 'Database Design',
          goal: 'Learn to think "how should I structure information?" before you start building.',
          content: 'This is one of the biggest level-up skills for the kind of tools you are building. Better database design means better trackers, better portals, and fewer painful rewrites later.',
          bullets: [
            'Learn about: collections, documents, relationships, and data normalisation.',
            'Practice thinking: what fields does a customer record need? What about a job? An invoice?',
            'Firestore is a NoSQL database — structure matters more than you might think.',
            'Recommended resource: Database Design Course by freeCodeCamp on YouTube (free, beginner friendly).',
            'Exercise: draw out the data structure for your Lakeside portal on paper before touching code.'
          ],
          extra: 'This will massively help your trackers, portals, customer systems, and any future SaaS ideas.'
        },
        {
          id: 'p2s2',
          title: 'Understanding APIs',
          goal: 'Understand how software talks to other software — and how to use it in your projects.',
          content: "An API is a controlled way for one system to communicate with another. You are already using APIs every time you call Firebase — you just might not have thought of it that way.",
          bullets: [
            'REST APIs: how most web services share data (requests and responses).',
            'JSON: the format data travels in — you have already seen this in Firebase.',
            'Fetch: how JavaScript requests data from an API.',
            'When you might need an API: payment processing, maps, email, SMS, weather, etc.',
            'Recommended: JavaScript.info has a good section on Fetch and async.',
            'Practice: find a free API (like an open weather or quote API) and display its data on a page.'
          ],
          extra: 'Knowing how APIs work unlocks connecting your apps to almost any external service.'
        },
        {
          id: 'p2s3',
          title: 'System Architecture',
          goal: 'See how hosting, APIs, databases, and frontend/backend all connect as one picture.',
          content: 'Architecture is the thing that separates hobby coders from app and systems designers. It is not about writing more code — it is about understanding the whole system before you build any part of it.',
          bullets: [
            'Key concepts: client/server, request/response, stateless vs stateful, caching.',
            'Draw diagrams: get in the habit of sketching how your systems work before coding.',
            'Recommended resource: ByteByteGo YouTube Channel — very visual, excellent explanations.',
            'Also useful: the architecture sections inside The Odin Project.',
            "You don't need to memorise everything — exposure is enough at this stage.",
            'Start asking: where does this data come from? Where does it go? Who can see it?'
          ],
          extra: "This is where hosting, APIs, databases, and frontend/backend start connecting mentally. Once it clicks, you can't unsee it."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     RECOMMENDED LEARNING PATH — Phase 3
  ══════════════════════════════════════════════ */
  function buildPhase3Program() {
    return {
      id: 'recommended_phase3',
      title: 'Recommended Path — Phase 3: Advanced Skills',
      description: 'React, UX/UI design, AI-assisted development, and SaaS thinking. Do not rush here — build on Phase 1 and 2 first.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'p3s1',
          title: 'React',
          goal: 'Learn the tool that makes complex frontend apps much more manageable.',
          content: "React is where modern app development starts becoming cleaner. But don't jump too early. You first need Git, hosting, architecture, and frontend/backend understanding — then React becomes much easier.",
          bullets: [
            'React lets you build UIs from reusable components instead of one big HTML file.',
            'State management: React handles data changes and re-renders automatically.',
            'Recommended resource: Scrimba React Course — very visual and interactive, likely suits your learning style well.',
            'Also good: the official React documentation at react.dev — well written and example-led.',
            'Do NOT start here. Come back once Phase 1 and 2 feel comfortable.',
            'You will know you are ready when Git, Firebase, and deployment feel routine.'
          ],
          extra: 'React is the right next step after the foundations. Not before.'
        },
        {
          id: 'p3s2',
          title: 'UX/UI Design',
          goal: 'Formalise a strength you already naturally have.',
          content: "Honestly, this is one of your strongest potential areas. You naturally think about usability, workflow, visuals, and real-world user problems. That's genuinely valuable — and rare.",
          bullets: [
            'UX = User Experience: how something feels to use.',
            'UI = User Interface: how something looks.',
            'You already do this intuitively. Formalising it gives you vocabulary and methods.',
            'Recommended resource: Google UX Design Certificate on Coursera.',
            'You do NOT need the certificate itself — but the thinking and process it teaches is excellent.',
            'Focus on: user research, wireframing, prototyping, and usability testing.'
          ],
          extra: "You're already halfway there. This just gives you the framework to do it more deliberately."
        },
        {
          id: 'p3s3',
          title: 'AI-Assisted Development',
          goal: 'Use AI tools properly, safely, and more effectively than most people currently do.',
          content: "You are already naturally using ChatGPT, Claude, and similar tools better than many beginners. Now it's worth being more deliberate about how you use them.",
          bullets: [
            'Prompting for architecture: describe the system you want to build, not just individual pieces.',
            'Debugging with AI: paste the error, paste the relevant code, explain what you expected.',
            'Reviewing AI code: never paste AI code into a live project without reading and understanding it.',
            'Using AI safely: AI makes mistakes. It is a capable assistant, not an authority.',
            'Recommended: Cursor Documentation — cursor.sh/docs.',
            'Also: Claude Code Documentation — how to get the most out of AI coding tools.',
            'Key skill: knowing what questions to ask, not just accepting the first answer.'
          ],
          extra: "You're already doing this well. A bit of intentional practice will make you much more effective."
        },
        {
          id: 'p3s4',
          title: 'SaaS & Product Thinking',
          goal: 'Think like a systems designer and product builder, not just a website creator.',
          content: "You're starting to think like a systems designer, workflow organiser, and product builder. That's more valuable than most people realise. This is the mindset behind every successful online tool.",
          bullets: [
            'SaaS = Software as a Service: people pay to access your tool online, usually monthly.',
            'Product thinking: what problem does this solve? For who? Why would they pay for it?',
            'Recommended resource: Y Combinator Startup School — free, not coding-focused.',
            'More about: product thinking, identifying user problems, and SaaS mindset.',
            'Your portals and trackers are already moving in this direction.',
            'Exercise: write a one-paragraph description of who would use your Lakeside portal and why.'
          ],
          extra: "You learned by building. That's how many very successful developers and product designers learned. You're already further along than you think."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     LAKESIDE — GOING LIVE (URGENT)
  ══════════════════════════════════════════════ */
  function buildLakesideProgram() {
    return {
      id: 'lakeside_golive',
      title: '⚡ Lakeside Portal — Going Live Checklist',
      description: 'Everything you need to check, learn, and do before Lakeside goes live with real users. Work through this before launch.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'lk1',
          title: 'Firebase Security Rules — Final Check',
          goal: 'Make sure no data is publicly readable or writable before real users log in.',
          content: 'The most common pre-launch mistake with Firebase is leaving rules too open. This is the single most important technical thing to get right before going live.',
          bullets: [
            'Go to Firebase Console > Firestore > Rules.',
            'Your rules should NOT allow read/write if request.auth == null (i.e. not logged in).',
            'Check every collection: jobs, quotes, invoices, customers — who should be able to read each one?',
            'Admin vs staff vs client: are the right people seeing the right data?',
            'Use the Rules Playground in Firebase Console to test rules before deploying.',
            'Common safe starting point: allow read, write: if request.auth != null; — then tighten from there.',
            'Check Storage rules too if you store any files or images.'
          ],
          extra: 'Run through the Rules Playground with a test user account before launch. It takes 10 minutes and catches most problems.'
        },
        {
          id: 'lk2',
          title: 'End-to-End Testing Before Launch',
          goal: 'Walk through every user journey as if you are the client — before they do.',
          content: "Testing doesn't need to be complicated. The goal is to find obvious problems before real users do. Go through the whole app as each type of user.",
          bullets: [
            'Create a fresh test account and go through the full signup/login flow.',
            'Add a job, edit it, update its status — does everything save correctly?',
            'Test on mobile: does it work on your phone? Is anything cut off or hard to tap?',
            'Test on a different browser (Chrome, Safari, Firefox).',
            'What happens if the internet drops mid-action? Does anything break badly?',
            'Check every form: what happens if you leave a required field empty?',
            'Walk through the client view (if applicable): what can they see and do?',
            'Write down anything that felt confusing — that is your snag list.'
          ],
          extra: 'Ask someone else to use it without you explaining it. Watch where they get confused. That is your UX feedback.'
        },
        {
          id: 'lk3',
          title: 'GDPR & Data Responsibilities for Client Portals',
          goal: 'Know what you are legally responsible for when you store real customer data.',
          content: "Because Lakeside will hold real business data (customer names, contact details, job records), GDPR applies. You don't need a solicitor — but you do need a few basics in place.",
          bullets: [
            'Privacy Policy: there should be one linked on the portal. It can be simple.',
            'Data minimisation: only collect fields you actually use.',
            'Access control: only the right people should see each record (your Firebase Rules handle most of this).',
            'Retention: how long are old job records kept? Is there a way to delete them?',
            'Breach awareness: if data was ever exposed, you have 72 hours to report it to the DPC (Ireland).',
            'Hosting location: Firebase europe-west means your data stays in the EU — that is correct for GDPR.',
            'The DPC (Data Protection Commission Ireland) has a free SME checklist at dataprotection.ie.'
          ],
          extra: "You are not building a healthcare or banking system — the bar is manageable. The main thing is being able to show you thought about it."
        },
        {
          id: 'lk4',
          title: 'Email Notifications for Job Updates',
          goal: 'Send automatic emails when a job status changes, so clients and staff stay informed without manual chasing.',
          content: "For a grounds maintenance portal, email notifications are a huge quality-of-life feature. Client gets notified when a job is scheduled. Staff gets notified when a new job is added.",
          bullets: [
            'Easiest approach with no backend: EmailJS — lets you send emails from JavaScript without a server.',
            'Sign up at emailjs.com — free tier allows 200 emails/month.',
            'Connect your email account, set up a template, then trigger it in your Firebase onSnapshot or button click.',
            'More powerful approach (when ready): Firebase Cloud Functions + Nodemailer or SendGrid.',
            'What emails are worth sending: new job created, job status changed, quote approved, invoice sent.',
            'Keep email content simple: job reference, what changed, a link back to the portal.',
            'Test with your own email address first before connecting to client accounts.'
          ],
          extra: 'Start with EmailJS — it is the quickest path to working emails with your current Firebase setup. Cloud Functions can come later.'
        },
        {
          id: 'lk5',
          title: 'Emergency Plan — What To Do When Something Breaks',
          goal: 'Have a calm plan ready so a live incident does not become a panic.',
          content: "Things will go wrong at some point. Having a plan means you stay calm and fix things methodically instead of making rushed changes that cause more problems.",
          bullets: [
            'Know where the logs are: Firebase Console > Functions > Logs, and your hosting platform logs.',
            'Keep a staging version: a copy of the portal you can test fixes on before pushing to live.',
            'Version control is your safety net: if a bad deploy happens, git revert gets you back quickly.',
            'Have the Firebase Console bookmarked and know how to quickly check: Auth users, Firestore data, Rules.',
            'Common issues: users locked out (check Auth), data not saving (check Rules), page not loading (check Hosting deploy log).',
            'Client communication: have a template message ready: "We are aware of an issue and working on it — we will update you by [time]."',
            "Don't make multiple changes at once when something is broken — one change, then check."
          ],
          extra: 'The golden rule: when something breaks in production, slow down. Panic fixes cause more problems than the original issue.'
        },
        {
          id: 'lk6',
          title: 'Client Handover & Training',
          goal: 'Make sure the Lakeside team can actually use the portal confidently without you there.',
          content: "A great portal that people do not know how to use is a failed portal. A short, clear handover goes a long way.",
          bullets: [
            'Write a one-page "how to use this" guide — screenshots help enormously.',
            'Record a short screen recording walkthrough (Loom is free and easy — loom.com).',
            'Cover: logging in, adding a job, updating a status, finding a customer record.',
            'Make sure they know how to contact you if something goes wrong — and what counts as urgent vs not urgent.',
            'Set expectations: what you will support, what you will charge for future changes.',
            'If there are multiple users, do the handover with everyone present at once.',
            'Leave them with a list of login URLs, support contact, and what browser works best.'
          ],
          extra: "The handover is also where you find out what they actually wanted vs what you built. Better to find out now than six months in."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     EVERYDAY DEVELOPER TOOLS
  ══════════════════════════════════════════════ */
  function buildDevToolsProgram() {
    return {
      id: 'everyday_dev_tools',
      title: 'Everyday Developer Tools',
      description: 'CSS layout, Chrome DevTools, and DNS. Practical skills you will use constantly.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'dt1',
          title: 'CSS Flexbox',
          goal: 'Stop guessing at layout and understand how to align things properly.',
          content: 'Flexbox is the tool that makes putting things side by side, centring them, and making them wrap on mobile actually make sense. Once it clicks, you stop fighting CSS.',
          bullets: [
            'display: flex — turns a container into a flexbox.',
            'flex-direction: row or column — which way items flow.',
            'justify-content — aligns items along the main axis (horizontal by default).',
            'align-items — aligns items on the cross axis (vertical by default).',
            'flex-wrap: wrap — lets items wrap to the next line instead of overflowing.',
            'gap — space between items, much easier than margins.',
            'Best resource: Flexbox Froggy at flexboxfroggy.com — a free game that teaches Flexbox visually. Genuinely the best way to learn it.',
            'Also: CSS Tricks Complete Guide to Flexbox — css-tricks.com/snippets/css/a-guide-to-flexbox.'
          ],
          extra: 'Play Flexbox Froggy first. Then open one of your existing projects and try to recreate a layout section using only Flexbox.'
        },
        {
          id: 'dt2',
          title: 'CSS Grid',
          goal: 'Build two-dimensional layouts (rows AND columns) without fighting the browser.',
          content: "Grid is Flexbox's sibling — while Flexbox works in one direction at a time, Grid handles both rows and columns at once. It is what powers the card grids and dashboard layouts in your projects.",
          bullets: [
            'display: grid — turns a container into a grid.',
            'grid-template-columns — defines the columns, e.g. repeat(3, 1fr) for three equal columns.',
            'grid-template-rows — defines the rows.',
            'gap — space between rows and columns.',
            'grid-column and grid-row — span an item across multiple cells.',
            'auto-fill vs auto-fit — for responsive grids that adjust without media queries.',
            'Best resource: Grid Garden at cssgridgarden.com — same team as Flexbox Froggy, same game format.',
            'Also: CSS Tricks Complete Guide to Grid — css-tricks.com/snippets/css/complete-guide-grid.'
          ],
          extra: 'Your training portal uses CSS Grid for the program cards. Open it in DevTools and inspect the grid to see it in action.'
        },
        {
          id: 'dt3',
          title: 'Chrome DevTools',
          goal: 'Use your browser as a development tool, not just a browser.',
          content: "DevTools is built into Chrome (and Edge and Firefox have the same). Most developers have it open almost constantly. It lets you inspect HTML, tweak CSS live, debug JavaScript, and watch network requests — without touching your code files.",
          bullets: [
            'Open it: F12, or right-click anything on a page and choose Inspect.',
            'Elements tab: see and edit the HTML and CSS of any page live (changes are not saved — just for testing).',
            'Console tab: run JavaScript, see errors, and use console.log() output.',
            'Network tab: see every request your page makes — API calls, images, scripts.',
            'Application tab: see localStorage, cookies, and cached files.',
            'Mobile view: click the device icon to preview your page at phone screen sizes.',
            'Tip: when something is not styled correctly, inspect it in Elements and try CSS changes live before editing your file.',
            'Recommended: Google Chrome DevTools documentation — developers.google.com/web/tools/chrome-devtools.'
          ],
          extra: "Right-click > Inspect on your own projects and have a look around. You will immediately start seeing things that are useful."
        },
        {
          id: 'dt4',
          title: 'DNS & Domain Management',
          goal: 'Understand what happens between buying a domain and it working on your hosting.',
          content: "You already manage domains. Understanding what the records actually mean removes the mystery — and means you can diagnose problems yourself instead of waiting and hoping.",
          bullets: [
            'A Record: points your domain to an IP address (usually your hosting server).',
            'CNAME Record: points a subdomain (like www) to another domain name — used by Netlify, Firebase, etc.',
            'MX Record: controls where email for your domain goes (e.g. Google Workspace, Outlook).',
            'TXT Record: used for verification (proving you own the domain to Google, Firebase, etc.).',
            'TTL (Time to Live): how long DNS changes take to spread — usually 24-48 hours for big changes.',
            'NS Records: nameservers — whoever controls these controls all other DNS records.',
            'Useful free tool: dnschecker.org — shows you what DNS records are currently set and if changes have propagated.',
            'Your registrar (where you bought the domain) is where you edit these records.'
          ],
          extra: "When a site is not loading after a deploy, DNS is usually the culprit. Knowing what to check saves a lot of anxious waiting."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     BUSINESS & CLIENT SKILLS
  ══════════════════════════════════════════════ */
  function buildBusinessProgram() {
    return {
      id: 'business_client_skills',
      title: 'Business & Client Skills',
      description: 'SEO for your website, pricing your tools, and managing client projects. The non-coding skills that make your work sustainable.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'bs1',
          title: 'SEO Basics for Your Business Website',
          goal: 'Help Google find and recommend stephrawlingscreations.ie to the right people.',
          content: "SEO (Search Engine Optimisation) is not magic — it is mostly making sure Google can read your site, understands what it is about, and sees it as trustworthy. Most of the basics are not technical.",
          bullets: [
            'Page titles and meta descriptions: every page should have a clear, specific title (not just "Home").',
            'Headings: use H1 for the main title of each page, H2 for sections. Only one H1 per page.',
            'Alt text on images: describe what is in each image — helps Google and accessibility.',
            'Page speed: slow pages rank lower. Test yours at pagespeed.web.dev.',
            'Mobile-friendly: Google ranks mobile-first. Test at search.google.com/test/mobile-friendly.',
            'Local SEO: for your Irish business — set up a free Google Business Profile at business.google.com.',
            'Backlinks: links from other sites to yours help ranking. Get listed in local directories.',
            'Recommended: Google Search Central documentation — developers.google.com/search/docs. Beginner-friendly and free.',
            'Free tool: Google Search Console — shows you how your site appears in search results.'
          ],
          extra: 'Local SEO (Google Business Profile) is the highest-impact thing for an Irish craft business. Do that first.'
        },
        {
          id: 'bs2',
          title: 'Pricing Your Portals & Digital Tools',
          goal: 'Know how to charge for the SaaS-style tools you are building.',
          content: "You are building real business tools for real clients. Knowing how to price them — and have that conversation — is as important as building them.",
          bullets: [
            'Project fee: charge once for building it. Simple, clear, but you get nothing for ongoing support.',
            'Retainer: monthly fee for hosting, updates, and support. Recurring income, more sustainable.',
            'Hybrid: lower upfront build fee + monthly retainer. Often the most attractive to clients.',
            'What to include in a retainer: hosting costs, minor updates, bug fixes, Firebase fees.',
            'What to charge extra for: new features, major redesigns, adding new users or roles.',
            'How to estimate: how many hours will it take? What is your hourly rate? Add 30% for unknowns.',
            'The conversation: "This is what I am building, this is what it costs, this is what the monthly fee covers."',
            'Useful read: "Stop Undercharging" by Paul Jarvis — pjrvs.com (short, practical, free).'
          ],
          extra: "Most first-time builders undercharge significantly. Your tools save clients real time and money — price them accordingly."
        },
        {
          id: 'bs3',
          title: 'Scoping & Delivering Client Projects',
          goal: 'Turn a vague client request into a clear, agreed plan — and deliver without scope creep.',
          content: "The biggest source of stress in client projects is unclear expectations at the start. A good scoping conversation at the beginning saves enormous pain later.",
          bullets: [
            'Discovery questions: what problem are you solving? Who uses it? What does success look like?',
            'Write it down: a simple one-page brief stating what is and is not included. Get it agreed in writing.',
            'Scope creep: when clients ask for extra features mid-project. Always fine to say "that is a new piece of work."',
            'Milestones: break the project into checkpoints. Client approves each stage before you build the next.',
            'Feedback rounds: agree how many rounds of changes are included. After that, additional changes are charged.',
            'Handover: what does "done" look like? Training, documentation, live deployment?',
            'Change requests: have a simple email template — "Happy to add that. It will take X hours at Y rate."',
            'Useful template: a simple project brief document — title, problem, users, features in scope, features not in scope, timeline, cost.'
          ],
          extra: "The clients who cause the most stress are usually the ones who were never properly scoped at the start. A 30-minute scoping call saves weeks."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     PROFESSIONAL STANDARDS
  ══════════════════════════════════════════════ */
  function buildProfessionalProgram() {
    return {
      id: 'professional_standards',
      title: 'Professional Standards',
      description: 'Web security, accessibility, testing, PWAs, and email APIs. The things that separate a good app from a professional one.',
      createdAt: new Date().toISOString(),
      checks: {}, notes: {}, weeklyChecks: {},
      sections: [
        {
          id: 'ps1',
          title: 'Web Security Basics',
          goal: 'Know the most common ways apps get attacked — and how to avoid them.',
          content: "You are building apps with real user data. You do not need to become a security expert, but knowing the basics protects your users and your reputation.",
          bullets: [
            'XSS (Cross-Site Scripting): when an attacker injects malicious code into your page. Prevention: never use innerHTML with user-supplied content — use textContent instead.',
            'HTTPS: always use it. Netlify and Firebase Hosting provide it for free. Never deploy to plain HTTP.',
            'CORS (Cross-Origin Resource Sharing): controls which sites can make requests to your backend. Firebase handles this, but understand what it means.',
            'API keys in code: never put Firebase or other API keys directly in public JavaScript without restricting them. Restrict your Firebase API key in Google Cloud Console.',
            'Authentication tokens: Firebase Auth handles this securely — use it, do not roll your own.',
            'Dependencies: keep your npm packages updated. Outdated packages are a common attack vector.',
            'Recommended: OWASP Top 10 at owasp.org — the ten most common web security risks, explained plainly.'
          ],
          extra: "The biggest risk for your projects is an open Firebase database and XSS from user inputs. Check both of those first."
        },
        {
          id: 'ps2',
          title: 'Accessibility (a11y) Basics',
          goal: 'Make your sites usable by everyone — and meet EU legal requirements.',
          content: "The EU Web Accessibility Directive applies to public sector bodies in Ireland and increasingly to businesses. Beyond legal requirements, accessible sites are just better — they work better for everyone.",
          bullets: [
            'Alt text: every meaningful image needs descriptive alt text.',
            'Colour contrast: text must have enough contrast against its background. Test at webaim.org/resources/contrastchecker.',
            'Keyboard navigation: can you use your site using only Tab and Enter? Many people rely on this.',
            'Headings: use them in logical order (H1, H2, H3) — screen readers use them to navigate.',
            'Labels on forms: every input needs a visible label, not just placeholder text.',
            'Focus states: when a user tabs to a button or link, it should be visibly highlighted.',
            'Recommended: WebAIM at webaim.org — free, practical, beginner-friendly accessibility guidance.',
            'Free audit tool: WAVE at wave.webaim.org — paste your URL and it highlights accessibility issues.'
          ],
          extra: "Run WAVE on your string art site and your Lakeside portal. Fix the red errors first — those are the most impactful."
        },
        {
          id: 'ps3',
          title: 'Testing Basics',
          goal: 'Check that your app works before users find out it does not.',
          content: "Testing does not have to mean writing automated test code. For your projects right now, it mostly means being deliberate about checking things before you ship them.",
          bullets: [
            'Manual testing: go through every user journey before every deploy. Write a simple checklist.',
            'Happy path: does it work when everything goes right?',
            'Edge cases: what if the user leaves a field empty? Enters a very long name? Has no data yet?',
            'Cross-browser testing: test in Chrome, Safari, and Firefox. Safari on iPhone behaves differently.',
            'Mobile testing: use real devices, not just browser emulation.',
            'Console errors: open DevTools and check the Console tab — red errors need fixing before launch.',
            'Firebase emulator: lets you test Firestore and Auth locally without affecting your live database.',
            'Recommended for later: Vitest or Jest for automated JavaScript unit tests — when your projects grow large enough to need it.'
          ],
          extra: "Build a simple pre-launch checklist for each project. Even five items is better than nothing."
        },
        {
          id: 'ps4',
          title: 'Progressive Web Apps (PWA)',
          goal: 'Understand the technology behind apps like Focus Flow that install on your home screen.',
          content: "Focus Flow is already a PWA. Understanding what that means lets you build them intentionally and debug them when something goes wrong.",
          bullets: [
            'What makes a PWA: a manifest.json file, a service worker, and HTTPS.',
            'manifest.json: tells the browser the app name, icon, colours, and how to display it when installed.',
            'Service worker: a background script that caches files so the app works offline.',
            'Install prompt: appears when your PWA meets the criteria — users can add it to their home screen.',
            'Offline support: the service worker serves cached files when there is no internet.',
            'Push notifications: PWAs can send notifications — you have this in Focus Flow already.',
            'Debugging: Chrome DevTools > Application tab > Service Workers and Manifest.',
            'Recommended: web.dev/progressive-web-apps — Google\'s own PWA guide, free and well written.'
          ],
          extra: 'Open Focus Flow in DevTools > Application and look at the Manifest and Service Workers tabs. You will immediately see what is going on.'
        },
        {
          id: 'ps5',
          title: 'Email & Notification APIs',
          goal: 'Send automated emails from your apps without needing a backend server.',
          content: "Automated emails make portals and trackers feel professional. A client getting an email when their job is updated is a huge quality-of-life improvement — and it is not hard to add.",
          bullets: [
            'EmailJS: send emails from JavaScript without a server. Free tier: 200 emails/month. emailjs.com.',
            'Setup: create an account, connect your email, build a template, then call emailjs.send() in your code.',
            'Use cases: job status changed, new quote sent, invoice ready, new user registered.',
            'Resend: newer alternative to EmailJS — resend.com. Generous free tier, clean API.',
            'Firebase Cloud Functions + Nodemailer: more powerful, needs a little backend knowledge — save for later.',
            'SendGrid: used by large apps. Free tier 100 emails/day. More setup required.',
            'Template tip: keep emails short — job reference, what changed, a link back to the portal. That is all.',
            'Always test with your own email first before sending to clients.'
          ],
          extra: "Start with EmailJS for Lakeside — it works directly with your existing Firebase setup and takes about an hour to get working."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     BUILT-IN PROGRAMS (merged in automatically)
  ══════════════════════════════════════════════ */
  const BUILT_IN_IDS = [
    'software_dev',
    'recommended_phase1',
    'recommended_phase2',
    'recommended_phase3',
    'lakeside_golive',
    'everyday_dev_tools',
    'business_client_skills',
    'professional_standards'
  ];

  function getBuiltInProgram(id) {
    switch (id) {
      case 'software_dev':           return buildDefaultProgram();
      case 'recommended_phase1':     return buildPhase1Program();
      case 'recommended_phase2':     return buildPhase2Program();
      case 'recommended_phase3':     return buildPhase3Program();
      case 'lakeside_golive':        return buildLakesideProgram();
      case 'everyday_dev_tools':     return buildDevToolsProgram();
      case 'business_client_skills': return buildBusinessProgram();
      case 'professional_standards': return buildProfessionalProgram();
    }
  }


  /* ══════════════════════════════════════════════
     DATA HELPERS
  ══════════════════════════════════════════════ */
  function getData() {
    let data = Storage.getTrainingData();
    if (!data) {
      data = { programs: BUILT_IN_IDS.map(id => getBuiltInProgram(id)) };
      Storage.saveTrainingData(data);
    } else {
      // Merge in any built-in programs added since the user last loaded
      let changed = false;
      BUILT_IN_IDS.forEach(id => {
        if (!data.programs.find(p => p.id === id)) {
          data.programs.push(getBuiltInProgram(id));
          changed = true;
        }
      });
      if (changed) Storage.saveTrainingData(data);
    }
    return data;
  }

  function saveData(data) {
    Storage.saveTrainingData(data);
  }


  /* ══════════════════════════════════════════════
     INTERNAL VIEW SWITCHING
  ══════════════════════════════════════════════ */
  function showHome() {
    currentProgramId = null;
    document.getElementById('tr-home').style.display = '';
    document.getElementById('tr-program').style.display = 'none';
    const scroll = document.querySelector('#view-training .view-scroll');
    if (scroll) scroll.scrollTop = 0;
    renderHome();
  }

  function showProgram(programId) {
    currentProgramId = programId;
    document.getElementById('tr-home').style.display = 'none';
    document.getElementById('tr-program').style.display = '';
    const scroll = document.querySelector('#view-training .view-scroll');
    if (scroll) scroll.scrollTop = 0;
    renderProgram();
  }


  /* ══════════════════════════════════════════════
     HOME — stats + program cards
  ══════════════════════════════════════════════ */
  function renderHome() {
    renderStats();
    renderProgramCards();
  }

  function renderStats() {
    const data = getData();
    let totalSections = 0, totalChecked = 0;
    data.programs.forEach(p => {
      (p.sections || []).forEach(s => {
        totalSections++;
        if (p.checks && p.checks[s.id]) totalChecked++;
      });
    });
    const pct = totalSections > 0 ? Math.round((totalChecked / totalSections) * 100) : 0;

    document.getElementById('tr-stats').innerHTML = `
      <div class="tr-stats-row">
        <div class="tr-stat"><div class="tr-stat-num">${data.programs.length}</div><div class="tr-stat-lbl">Programs</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${totalSections}</div><div class="tr-stat-lbl">Sections</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${totalChecked}</div><div class="tr-stat-lbl">Done</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${pct}%</div><div class="tr-stat-lbl">Overall</div></div>
      </div>
    `;
  }

  function renderProgramCards() {
    const data = getData();
    let html = '<div class="tr-grid">';

    data.programs.forEach(program => {
      const sections = program.sections || [];
      const total   = sections.length;
      const checked = sections.filter(s => program.checks && program.checks[s.id]).length;
      const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

      html += `
        <div class="tr-card" onclick="Training._openProgram('${tEsc(program.id)}')">
          <button class="tr-card-del" title="Delete program"
            onclick="event.stopPropagation(); Training._confirmDelete('${tEsc(program.id)}')">&#x2715;</button>
          <div class="tr-card-title">${tEscHtml(program.title)}</div>
          <div class="tr-card-desc">${tEscHtml(program.description || '')}</div>
          <div class="tr-prog-wrap"><div class="tr-prog-bar" style="width:${pct}%"></div></div>
          <div class="tr-prog-lbl">${pct}% &bull; ${checked} of ${total} sections</div>
        </div>
      `;
    });

    html += `
      <button class="tr-add-card" onclick="Training.openNewProgramModal()">+ New Training Program</button>
    </div>`;

    document.getElementById('tr-grid').innerHTML = html;
  }


  /* ══════════════════════════════════════════════
     PROGRAM DETAIL
  ══════════════════════════════════════════════ */
  function renderProgram() {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) { showHome(); return; }

    document.getElementById('tr-program-title').textContent = program.title;
    renderSections(program);
    updateProgress(program);
    loadWeeklyChecks(program);
  }

  function updateProgress(program) {
    const sections = program.sections || [];
    const total   = sections.length;
    const checked = sections.filter(s => program.checks && program.checks[s.id]).length;
    const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

    document.getElementById('tr-prog-bar2').style.width = pct + '%';
    document.getElementById('tr-prog-text').textContent =
      `${pct}% complete (${checked} of ${total} sections)`;
  }

  function renderSections(program) {
    const container = document.getElementById('tr-sections');
    const sections  = program.sections || [];

    if (!sections.length) {
      container.innerHTML = `
        <div class="tr-empty">
          <strong>No sections yet.</strong>
          <p>Use the form below to add your first section.</p>
        </div>`;
      return;
    }

    container.innerHTML = sections.map((section, index) => {
      const isChecked = program.checks && program.checks[section.id] ? 'checked' : '';
      const noteVal   = (program.notes  && program.notes[section.id]) || '';

      let body = '';
      if (section.goal)    body += `<div class="tr-callout">${tEscHtml(section.goal)}</div>`;
      if (section.content) body += `<p>${tEscHtml(section.content)}</p>`;
      if (section.bullets && section.bullets.length) {
        body += '<ul>' + section.bullets.map(b => `<li>${tEscHtml(b)}</li>`).join('') + '</ul>';
      }
      if (section.code)    body += `<pre class="tr-code">${tEscHtml(section.code)}</pre>`;
      if (section.extra)   body += `<p><em>${tEscHtml(section.extra)}</em></p>`;

      return `
        <details class="tr-details" id="trdet-${tEsc(section.id)}">
          <summary class="tr-summary">
            <input type="checkbox" ${isChecked}
              onclick="event.stopPropagation()"
              onchange="Training._toggleSection('${tEsc(section.id)}', this.checked)">
            <span class="tr-sum-title">Section ${index + 1} &ndash; ${tEscHtml(section.title)}</span>
            <svg class="tr-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
          </summary>
          <div class="tr-sec-body">
            <div class="tr-sec-content">${body}</div>
            <p class="tr-notes-lbl">Your notes</p>
            <textarea class="tr-textarea"
              placeholder="Write your notes here..."
              oninput="Training._saveNote('${tEsc(section.id)}', this.value)"
            >${tEscHtml(noteVal)}</textarea>
            <div class="tr-sec-footer">
              <button class="tr-del-sec-btn"
                onclick="Training._deleteSection('${tEsc(section.id)}')">Remove section</button>
            </div>
          </div>
        </details>`;
    }).join('');
  }


  /* ══════════════════════════════════════════════
     SECTION ACTIONS
  ══════════════════════════════════════════════ */
  function toggleSection(sectionId, checked) {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (!program.checks) program.checks = {};
    program.checks[sectionId] = checked;
    saveData(data);
    updateProgress(program);
  }

  function saveNote(sectionId, value) {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (!program.notes) program.notes = {};
    program.notes[sectionId] = value;
    saveData(data);
  }

  function deleteSection(sectionId) {
    if (!confirm('Remove this section? Your notes for it will also be deleted.')) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    program.sections = program.sections.filter(s => s.id !== sectionId);
    if (program.checks) delete program.checks[sectionId];
    if (program.notes)  delete program.notes[sectionId];
    saveData(data);
    renderProgram();
  }

  function addSection() {
    const titleEl   = document.getElementById('tr-new-title');
    const contentEl = document.getElementById('tr-new-content');
    const title     = titleEl.value.trim();
    const content   = contentEl.value.trim();

    if (!title) {
      Toast.warning('Please enter a section title.');
      titleEl.focus();
      return;
    }

    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;

    const newSection = { id: 'sec_' + Date.now(), title, content };
    if (!program.sections) program.sections = [];
    program.sections.push(newSection);
    saveData(data);

    titleEl.value   = '';
    contentEl.value = '';
    renderProgram();
    Toast.success('Section added.');

    setTimeout(() => {
      const el = document.getElementById('trdet-' + newSection.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }


  /* ══════════════════════════════════════════════
     WEEKLY CHECKLIST
  ══════════════════════════════════════════════ */
  function loadWeeklyChecks(program) {
    const checks = program.weeklyChecks || {};
    document.querySelectorAll('[data-tr-weekly]').forEach(cb => {
      cb.checked  = !!checks[cb.dataset.trWeekly];
      cb.onchange = () => {
        const data = getData();
        const p    = data.programs.find(p => p.id === currentProgramId);
        if (!p) return;
        if (!p.weeklyChecks) p.weeklyChecks = {};
        p.weeklyChecks[cb.dataset.trWeekly] = cb.checked;
        saveData(data);
      };
    });
  }


  /* ══════════════════════════════════════════════
     PROGRAM MANAGEMENT
  ══════════════════════════════════════════════ */
  function openNewProgramModal() {
    document.getElementById('tr-modal-title').value = '';
    document.getElementById('tr-modal-desc').value  = '';
    Modal.open('modal-new-program');
  }

  function closeNewProgramModal() {
    Modal.close('modal-new-program');
  }

  function createProgram() {
    const title = document.getElementById('tr-modal-title').value.trim();
    const desc  = document.getElementById('tr-modal-desc').value.trim();
    if (!title) {
      Toast.warning('Please enter a program title.');
      document.getElementById('tr-modal-title').focus();
      return;
    }
    const data = getData();
    const newProgram = {
      id: 'prog_' + Date.now(),
      title,
      description: desc,
      createdAt: new Date().toISOString(),
      sections: [],
      checks: {},
      notes: {},
      weeklyChecks: {}
    };
    data.programs.push(newProgram);
    saveData(data);
    Modal.close('modal-new-program');
    Toast.success(`"${title}" created.`);
    showProgram(newProgram.id);
  }

  function confirmDeleteProgram(programId) {
    const data    = getData();
    const program = data.programs.find(p => p.id === programId);
    if (!program) return;
    if (data.programs.length === 1) {
      Toast.warning('You need at least one training program.');
      return;
    }
    if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) return;
    data.programs = data.programs.filter(p => p.id !== programId);
    saveData(data);
    Toast.success('Program deleted.');
    renderHome();
  }

  function deleteCurrentProgram() {
    if (!currentProgramId) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (data.programs.length === 1) {
      Toast.warning('You need at least one training program.');
      return;
    }
    if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) return;
    data.programs = data.programs.filter(p => p.id !== currentProgramId);
    saveData(data);
    Toast.success('Program deleted.');
    showHome();
  }

  function resetCurrentProgram() {
    if (!currentProgramId) return;
    if (!confirm('Reset all ticks and notes for this program? This cannot be undone.')) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    program.checks      = {};
    program.notes       = {};
    program.weeklyChecks = {};
    saveData(data);
    renderProgram();
    Toast.success('Progress reset.');
  }


  /* ══════════════════════════════════════════════
     OPEN / CLOSE ALL
  ══════════════════════════════════════════════ */
  function openAll()  { document.querySelectorAll('#tr-sections details').forEach(d => d.open = true);  }
  function closeAll() { document.querySelectorAll('#tr-sections details').forEach(d => d.open = false); }


  /* ══════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════ */
  function tEscHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tEsc(str) {
    return String(str).replace(/'/g, "\\'");
  }


  /* ══════════════════════════════════════════════
     INIT + PUBLIC API
  ══════════════════════════════════════════════ */
  function init() {
    // Ensure default data exists (creates it in Firebase if first run)
    getData();

    // Wire up buttons in the training view
    document.getElementById('tr-btn-open-all').addEventListener('click', openAll);
    document.getElementById('tr-btn-close-all').addEventListener('click', closeAll);
    document.getElementById('tr-btn-reset').addEventListener('click', resetCurrentProgram);
    document.getElementById('tr-btn-delete-prog').addEventListener('click', deleteCurrentProgram);
    document.getElementById('tr-btn-add-section').addEventListener('click', addSection);
    document.getElementById('tr-btn-create-program').addEventListener('click', createProgram);
    document.getElementById('tr-btn-cancel-modal').addEventListener('click', closeNewProgramModal);
    document.getElementById('tr-btn-new-program').addEventListener('click', openNewProgramModal);
  }

  function render() {
    if (currentProgramId) {
      renderProgram();
    } else {
      showHome();
    }
  }

  return {
    init,
    render,
    showHome,
    openNewProgramModal,

    // Called from inline HTML (onclick=)
    _openProgram:    showProgram,
    _confirmDelete:  confirmDeleteProgram,
    _toggleSection:  toggleSection,
    _saveNote:       saveNote,
    _deleteSection:  deleteSection,
  };

})();
