<flow name="How to Write (Good) Documentation" category="DOC/DEV" spid="foam" description="Guide that aims to alleviate the stress of writing documentation by providing a set of clear standards and best-practices, as well as a few handy tips and tricks for understanding your audience and writing effective articles." keywords="push documentation,knowledge"/>

# How to Write (Good) Documentation
Good documentation is an essential part of any respectable software, but it can be quite difficult to write (especially when one's audience is inexperienced or non-technical). Worse, not everyone agrees on what makes  documentation "good" or "bad".

This article aims to alleviate the stress of writing documentation by providing a set of clear standards and best-practices, as well as a few handy tips and tricks for understanding your audience and writing effective articles.

## Getting Started
As with any other task, when writing documentation you will generally need to do a bit of preparation beforehand. Specifically, you should be able to answer "who", "what", "where", "when", "why" and "how":

- **Who** Is your audience? Are they clients or developers, trainees or veterans? Do they expect a formal document or a fun one?
- **What** "type" of documentation are you writing? Is it a how-to or usage guide? What level of detail do you need to go into and what are the most important concepts or instructions you need to convey?
- **Where** will your documentation "live" once you've written it? Documentation with no clear home is easily lost.
- **When** will your documentation become relevant and when will it need to be updated? As with software, all documentation has a lifecycle that needs to be kept in mind while writing.
- **Why** is this documentation needed? Thinking critically about *why* you are writing a given bit of documentation will often help you identify key concepts, common issues, or confusion that your document will need to address.
- **How** familiar are you and your audience with the topic? Do you need to do a bit of "studying-up" before you start writing? Can you identify common problems and provide solutions? Will you be referencing concepts or terminology that your audience may not be familiar with?

<hint category="warning">
If you do not have answers to all of these questions **don't start writing**! You may end up having to rework major sections of your document. If you are not sure *how* to answer the above questions, fear not— the following sections are here to help.
</hint>

### Identifying your Audience

More often than not, whomever has requested the documentation you are writing either *is* your target audience or *knows* who is, so don't be afraid to ask! That being said, knowing who will be reading your documentation is only part of identifying your audience, the next step is figuring out what information is relevant to them and what style/tone they are expecting your document to be in.

Once again, this is something that you should ask whomever you are writing the documentation for, but as a general rule...

#### Clients expect...
Clear, non-technical explanations and step-by-step instructions that anticipate potential problems and offer immediate solutions. Clients do not appreciate technical jargon or code and they are generally unconcerned with "how" or "why" a system works in a particular way. When writing for clients, favour high-level overviews, use screenshots whenever possible, and emphasize system strengths. Aim for a semi-formal or formal tone and grammatical perfection. 

<hint category="success">
Remember: good documentation is also good marketing — clients who find our system easy to use and understand are more likely to recommend it to others.
</hint>

#### Engineers expect...
Concise, straight-forward documents that focus on what a system does and how/why a given task is performed. Engineers do not appreciate meandering or "flowery" text and are generally looking for either in-depth explanations or easy references for technical concepts or functionality. When writing for engineers, favour organization over decoration, use bullet points and diagrams as needed, and emphasize the pros, cons, and consequences of implementation details. Aim for a practical, semi-formal tone and clearly detail what concepts and terminology you are expecting the reader to be familiar with, already.

<hint category="hint">
Keep in mind: engineers often require at least two documents per topic — one to explain new concepts and terminology, and another that exposes implementation details and provides a step-by-step guide for building, breaking, or changing the system.
</hint>

#### Product teams expect...
A blend between client and engineering documentation that provides step-by-step instructions on how to use, demo, and administrate a system. Product teams — like clients — do not appreciate technical jargon or code and are generally looking for tutorials or easy references that can be used to quickly resolve client issues. When writing for product teams, favour how-to-style explanations, use screenshots and examples whenever possible, and emphasize solutions to common issues or industry pain points. Aim for a practical, semi-formal tone and provide clear roadmaps for system usage and workflow optimizations.

<hint category="warning">
Don't forget: product teams are the bridge between clients and engineers — if a system or document does not make sense to the product team, there is a good chance that the client will not understand it, either.
</hint>

#### Writing for a mixed audience
When writing documentation for an audience that does not fit neatly into one of the above categories, aim to be understood by the least-informed audience member and provide supplementary resources as required. For example, if you are are writing documentation that will be used by both clients and engineers, prioritize the client's understanding in the body of your text and move technical details to isolated sections such as collapsible tabs or appendices

### Choosing a Documentation "Type"
When someone asks you to write documentation, it is important that you understand what form of content they are expecting; are they looking for step-by-step instructions? A general overview? How much technical detail should be present? To answer these questions, it can be useful to use the Diátaxis system (also called the Grand Unified Theory of Documentation) which divides documentation materials into the following four types:

#### 1. Tutorials
Are **learning-oriented**, practical materials that provide readers with a clear goal and the means to achieve it. Tutorials are meant to *teach* the reader— they are not instruction manuals, they are lessons that help the reader build confidence and competence in a given area. Tutorials are notoriously difficult to write as they assume that the reader is a complete beginner and must provide them with enough information and actionable steps that they may use and follow subsequent documentation articles with no issue.

In other words, tutorials are the first materials that your users will interact with and as such, must provide a baseline for what knowledge and skills your user is expected to have by the time they read any other form of documentation, while also assuming that the reader knows absolutely nothing about absolutely everything.

<hint category="warning">
A poorly-written tutorial can (and will!) turn users away from your system, so be prepared to revise these often and do not rush the process; sometimes a bad tutorial is worse than no tutorial at all.
</hint>

#### 2. How-to Guides
Are **goal-oriented**, actionable instructions for solving a problem or performing a given task. How-to guides are meant to *direct* the reader and may assume that they have the baseline knowledge required to interact with a given system. How-to-guides tend to be fairly straightforward to write provided they are addressing a specific problem, but can quickly become unwieldy if they are tackling multiple issues at once. For example, a "*How-to make a BLT sandwich*" article is easier to write and more digestible for the reader than an article titled "*How-to cook*".

<hint category="hint">
You may notice that despite having "*How to*" in the title, this article is **not** a How-to Guide. As an exercise in understanding— what would *you* classify it as?
</hint>

#### 3. Explanations
Are **understanding-oriented** discussions of a given topic. Explanations tend to supply background or tertiary knowledge to the user and are not necessarily directly linked to any particular part of a system. They provide context and can answer the "whys" of a system (why this design/solution, why this procedure/protocol, why is this useful/relevant) but are not concerned with the practicalities of *how*.

In other words, explanations are discussion pieces that can be read "at one's leisure" — they will not teach you how to use a system, but they will give you a greater understanding of why it exists.

Explanations can be a bit tricky to write as they do not answer a specific question and tend to exist as snippets of context scattered throughout other materials, rather than unified documents. Articles that discuss the philosophy of an approach, architecture decision or design records, and documents outlining the historical context of an idea/invention are all good examples of explanations.

#### 4. References
Are **information-oriented**, technical materials that describe the inner-workings of a system and how to operate it. References are utilitarian, straight-to-the-point documents that describe things like APIs, functions and methods, key classes or variables, supported or restricted behaviour, etc.. References describe the correct usage of the system but they do **not** teach the reader how to accomplish a given task. References tend to be fairly straightforward to write as they are derived directly from the system or software they are referring to, however, they are generally insufficient documentation on their own and are typically accompanied by at least one other type of material.

#### Summary
The following table provides a quick summary of each of the four documentation types and their purpose to help you determine which form(s) would be most applicable to the material(s) you are creating.

|  | Tutorials | How-to Guides | Explanations | References |
|------|------|------|------|------|
|   Orientation   |   Learning   |   Goals   |   Understanding   |   Information   |
|   Purpose   |   Starting point for beginners   |   Instructions for completing a task   |   Discussions that provide context   |   Descriptions of technical terms and machinery   |
|   Form   |   Lessons, small projects, interactive examples   |   Sets of steps or directions   |   Articles, asides, or blog posts   |   Specifications, command lists, language/library catalogs   |
|   Goal   |   Teach   |   Direct   |   Explain   |   Describe   |
| Required Experience | None | Some (provided by tutorials) | Varies, often none | Varies, never none |
| Audience(s) | All | All | Varies by topic | Varies (rarely Clients) |

If you have further questions about the Diátaxis system, or need advice for writing a particular type of document, consider visiting one of the following external resources:

[Official Diátaxis website](https://diataxis.fr/), [Diátaxis as explained by Divio](https://docs.divio.com/documentation-system/), [Brigham Young University article on Diátaxis](https://ux.byu.edu/test-article)

### Finding a S.A.F.E. Place for your Documentation
An important but often overlooked part of writing "good" documentation is determining where the materials will live once they have been created. All too often genuinely useful resources find their way into hidden or inaccessible places where they are quickly forgotten. This results in wasted time on the part of the author, confusion and frustration on the part of the reader, and an inevitable duplication of work when the resources are recreated.

As such, while all organizations will choose to store their documentation differently, as a general rule ensure that your documentation lives somewhere **S**tructured, **A**ccessible, **F**requented, and **E**xplainable (**S.A.F.E.**).

#### Structured
Whether it be a folder of folders or an alphabetized list, documentation should always live somewhere that is logically structured. Most organizations have an established structure and set of naming/saving conventions for files within its ecosystem, but in the event that yours does not, here are a few tips and tricks that can help you get started:

- **Group by topic not type** - tempting though it may be, avoid grouping all of your tutorials, how-tos, or other forms of documentation together. In an ideal system, each folder contains only and all those materials related to a single topic.
- **Permission by audience** - in the event that internal and external documentation shares a repository, be sure to permission documentation by who is allowed to see what. It is unprofessional and inconvenient to be displaying developer guides or API references to non-technical clientele.
- **Use tags whenever possible**  - if your storage system supports it, it is a good idea to apply relevant tags to your documentation as this makes it easier for users, search engines, and LLMs alike to quickly find the files they need.
- **Use titles as filenames** - if your documentation is stored in an environment that allows you to edit both the title and the filename, keep the two in sync. This makes it easy to locate specific documents and mitigates the risk of document duplication.
- **Order logically** - should you have control over the order documentation files are stored and displayed in, order them in a way that makes logical sense. Put "beginner" or introductory documents first and ensure that topics or terms are introduced before they are used.
- **Keep it clean** - periodically review existing documentation and ensure that old or unused files are removed or updated as soon as possible. Avoid duplication or redundancy and enforce applicable conventions as needed.
- **Version when possible** - it is a good idea to indicate both what version of a particular piece of documentation is currently available, and what version the system was when the relevant documentation was written. It is incredibly frustrating to find out mid-process that the documentation you are referring to is for an older version of the system you are using!

#### Accessible
Documentation *must* be easily accessible to its target audience. Private repositories or local directories are useful for drafts, but final copies should not require members of the audience to make individual access requests.

It may be useful, therefore, to consider saving your documentation in the same repository (but not directory) that the system it pertains to is stored in. This may require the creation of an in-app reader, but it allows you to keep your code base and documentation in one place and ensures that in the event of a company dissolution or merger, you and your clients do not lose access to the materials required to operate the system.

Similarly, you may consider creating a dedicated repository, page, or platform for your documentation. In any case, please note that "accessible" does not mean "unprotected" — avoid hosting proprietary or trade-secret documents in open-access environments, and ensure that only those who *need* access to the documentation *have* it.

#### Frequented

#### Explainable

### Documentation Lifecycles

### Knowing "Why?"

### Gauging Experience