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
When someone asks you to write documentation, it can be useful to use the Diátaxis system which divides documentation into the following four types of materials:

#### Tutorials
Are **learning-oriented** practical materials that provide readers with a clear goal and the means to achieve it. Tutorials are meant to *teach* the reader— they are not instruction manuals, they are lessons that help the reader build confidence and competence in a given area. Tutorials are notoriously difficult to write as they assume that the reader is a complete beginner and must provide them with enough information and actionable steps that they may use and follow subsequent documentation articles with no issue.

In other words, tutorials are the first materials that your users will interact with and as such, must provide a baseline for what knowledge and skills your user is expected to have by the time they read any other form of documentation, while also assuming that the reader knows absolutely nothing about absolutely everything.

<hint category="warning">
A poorly-written tutorial can (and will!) turn users away from your system, so be prepared to revise these often and do not rush the process; sometimes a bad tutorial is worse than no tutorial at all.
</hint>

#### How-To Guides
Are **goal-oriented**, actionable instructions for solving a problem or performing a given task. How-to guides are meant to *direct* the reader and may assume that they have the baseline knowledge required to interact with a given system. How-to-guides tend to be fairly straightforward to write provided they are addressing a specific problem, but can quickly become unwieldy if they are tackling multiple issues at once. For example, a "*How-to make a BLT sandwich*" article is easier to write and more digestible for the reader than an article titled "*How-to cook*".

<hint category="hint">
You may notice that despite having "*How to*" in the title, this article is **not** a How-to Guide. As an exercise in understanding— what would *you* classify it as?
</hint>

#### Explanations
Are **understanding-oriented** discussions of a given topic. Explanations tend to take a "high-level" or alternative perspective of a given subject and provide context, 

#### References



### Finding a Home for your Documentation

### Documentation Lifecycles

### Knowing "Why?"

### Gauging Experience