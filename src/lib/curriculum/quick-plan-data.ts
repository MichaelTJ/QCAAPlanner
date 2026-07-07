export type QuickPlanType =
	| '7-8-digital-technologies'
	| '9-10-design'
	| '9-10-digital-technologies'
	| '10-engineering';

export interface CurriculumContentDescriptor {
	id: string;
	category: string;
	strand: string;
	subStrand: string;
	text: string;
	code: string;
}

export interface CurriculumPlanType {
	id: QuickPlanType;
	label: string;
	levelDescription: string;
	contentDescriptors: CurriculumContentDescriptor[];
}

const LEVEL_DESCRIPTION_7_8_DT = `By the end of Year 8 students should have had the opportunity to apply computational thinking by defining and decomposing real-world problems, creating user experiences, designing and modifying algorithms, and implementing them in a general-purpose programming language. This involves students practising problem decomposition, using approaches such as divide and conquer to more clearly understand a problem by describing its component parts. Students represent and communicate their algorithmic solutions using flowcharts and pseudocode. Students check their solutions meet the specifications by testing and debugging their algorithms before and during implementation. They develop a deeper understanding of abstraction by explaining how and why digital systems represent data as whole numbers, which are then represented in binary.

Students build on their skills from Mathematics (Statistics) in acquiring and interpreting data. In Digital Technologies, students continue to advance these skills and are also given opportunities to validate the data they acquire to ensure it is accurate and consistent. They collect and transform many types of data from a wide range of sources. Students model structured data in meaningful ways using spreadsheets and single-table databases, and analyse and visualise the data to extract meaning from it.

They apply design thinking by using divergent techniques, such as mind mapping, role-play and using graphic organisers, to generate design ideas for user experiences and solution designs. Students review these ideas against design criteria and created user stories throughout their implementation as general-purpose programming by assessing them against current and future needs. They extend the use of these design criteria and user stories to evaluate the future impact of existing solutions.

Students apply systems thinking by exploring the connections between hardware capabilities and tasks users want to perform. They investigate how data is transmitted via wired and wireless networks and explain the need for encryption to protect and secure data. Students use an increasing range of the features of digital tools to improve their efficiency and the consistency of the content they create, locate and communicate. They plan and manage projects individually and collaboratively, improving their control over the quality of their content. Students investigate personal security controls, including multi-factor authentication, to protect their data if passwords are compromised, and they understand the impact of phishing and other cyber security threats on people and data.

In Digital Technologies, students should have frequent opportunities for authentic learning by making key connections with other learning areas.`;

const LEVEL_DESCRIPTION_9_10_DESIGN = `By the end of Year 10 students should have had the opportunity to design and produce at least 4 designed solutions focused on one or more of the 4 technologies contexts:

Engineering principles and systems
Food and fibre production
Food specialisations
Materials and technologies specialisations.
Students should have opportunities to experience creating designed solutions for products, services and environments.

Students use design and technologies knowledge and understanding, processes and production skills and design thinking to produce designed solutions for identified needs or opportunities of relevance to individuals and local, regional or global communities. They work independently and collaboratively. Problem-solving activities acknowledge the complexities of contemporary life and make connections to related specialised occupations and further study. Increasingly, study has a global perspective, with opportunities to understand the complex interdependencies involved in the development of technologies and enterprises.

Students specifically focus on preferred futures, taking into account ethics; legal issues; social values; and economic, environmental and social sustainability factors; and use strategies such as life cycle thinking. They use critical thinking, creativity, innovation and enterprise skills with increasing confidence, independence and collaboration. Students analyse data, evaluate design ideas and technologies, respond to feedback, and evaluate design processes used to inform designed solutions for preferred futures.

Using a range of technologies including a variety of graphical representation techniques to communicate, students generate and represent original ideas and production plans in 2-dimensional and 3-dimensional representations. These techniques will be specific to the technologies context and may include scale, perspective, orthogonal and production drawings with sectional and exploded views. Students produce rendered, illustrated views for marketing and use graphic visualisation software to produce dynamic views of design ideas and designed solutions.

Students identify the steps involved in planning the production of designed solutions. They develop detailed project management plans, incorporating elements such as sequenced time, cost and action plans, to manage design tasks safely. Students apply management plans, making adjustments when necessary, to successfully complete design tasks. They identify and establish safety procedures that minimise risk and manage projects with safety and efficiency in mind, maintaining safety standards and management procedures to ensure success.`;

const LEVEL_DESCRIPTION_9_10_DIGITAL = `By the end of Year 10 students should have had the opportunity to apply computational thinking by defining and decomposing real-world problems, creating user experiences, designing and modifying algorithms, and implementing them, including in an object-oriented programming language. Students use techniques, including interviewing stakeholders to develop user stories, to increase the precision of their problem definitions and solution specifications. They verify their solutions solve the problem by validating their algorithms, represented as flowcharts and pseudocode, and using test cases to confirm the correctness of their solutions. Students develop their object-oriented programming skills, and apply them to develop, modify and debug programs. They explain the importance of abstraction by representing online documents in terms of content, structure and presentation, as well as exploring simple data compression techniques and comparing their effectiveness. Students consolidate their skills in data acquisition and interpretation, cleaning and validating data to ensure it is accurate, consistent and domain appropriate. They model multidimensional data in more complex spreadsheets and relational databases, filtering and querying it to give insights into its meaning, and to pose further questions or make conclusions. They visualise this data in customisable ways, allowing greater exploration of trends and outliers to support or challenge their analyses. Students apply design thinking by using divergent techniques to generate design ideas for user experiences and solutions. They filter and prototype these ideas, developing user stories and applying design criteria based on current and future needs and enterprising opportunities, as well as their created user stories, and revise and further develop their preferred ideas based on their analysis. Students extend on these design criteria and user stories to evaluate the enterprise opportunities and future impact of existing solutions. Students consolidate their systems thinking by exploring how the hardware and software components of digital systems interact to manage, control and secure access to data. They increasingly use advanced features of existing and emerging digital tools to create interactive content for a diverse audience. They explore simple tools that help plan tasks, timelines and responsibilities for individual and collaborative projects. Students extend their knowledge of the importance of security by developing cyber security threat models and exploring an example of a supply chain vulnerability. They critique the digital footprint created by existing systems and their own solutions by applying the Australian Privacy Principles.`;

const LEVEL_DESCRIPTION_10_ENGINEERING = `Students investigate real-world engineering problems and use knowledge of materials, systems, forces, motion and energy to design, prototype, test and refine engineered solutions. They apply engineering communication techniques such as sketching, CAD, diagrams, data tables and technical reports. Students use project management processes to plan and safely produce solutions, gather and analyse testing data, and evaluate their designs against success criteria including performance, sustainability, safety, cost and user needs.

Grade 10 Engineering is reported against Years 9–10 Design and Technologies descriptors in the Engineering principles and systems context, with selected Digital Technologies descriptors where students use data, CAD, simulation, coding, microcontrollers, spreadsheets or digital project tools.`;

const CONTENT_DESCRIPTORS_7_8_DT: CurriculumContentDescriptor[] = [
	{
		id: 'AC9TDI8K01',
		category: 'Knowledge and understanding',
		strand: 'Digital systems',
		subStrand: '',
		text: 'explain how hardware specifications affect performance and select appropriate hardware for particular tasks and workloads',
		code: 'AC9TDI8K01'
	},
	{
		id: 'AC9TDI8K02',
		category: 'Knowledge and understanding',
		strand: 'Digital systems',
		subStrand: '',
		text: 'investigate how data is transmitted and secured in wired and wireless networks including the internet',
		code: 'AC9TDI8K02'
	},
	{
		id: 'AC9TDI8K03',
		category: 'Knowledge and understanding',
		strand: 'Data representation',
		subStrand: '',
		text: 'investigate how digital systems represent text, image and audio data using integers',
		code: 'AC9TDI8K03'
	},
	{
		id: 'AC9TDI8K04',
		category: 'Knowledge and understanding',
		strand: 'Data representation',
		subStrand: '',
		text: 'explain how and why digital systems represent integers in binary',
		code: 'AC9TDI8K04'
	},
	{
		id: 'AC9TDI8P01',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'acquire, store and validate data from a range of sources using software, including spreadsheets and databases',
		code: 'AC9TDI8P01'
	},
	{
		id: 'AC9TDI8P02',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'analyse and visualise data using a range of software, including spreadsheets and databases, to draw conclusions and make predictions by identifying trends',
		code: 'AC9TDI8P02'
	},
	{
		id: 'AC9TDI8P03',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'model and query the attributes of objects and events using structured data',
		code: 'AC9TDI8P03'
	},
	{
		id: 'AC9TDI8P04',
		category: 'Processes and production skills',
		strand: 'Investigating and defining',
		subStrand: '',
		text: 'define and decompose real-world problems with design criteria and by creating user stories',
		code: 'AC9TDI8P04'
	},
	{
		id: 'AC9TDI8P05',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'design algorithms involving nested control structures and represent them using flowcharts and pseudocode',
		code: 'AC9TDI8P05'
	},
	{
		id: 'AC9TDI8P06',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'trace algorithms to predict output for a given input and to identify errors',
		code: 'AC9TDI8P06'
	},
	{
		id: 'AC9TDI8P07',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'design the user experience of a digital system',
		code: 'AC9TDI8P07'
	},
	{
		id: 'AC9TDI8P08',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'generate, modify, communicate and evaluate alternative designs',
		code: 'AC9TDI8P08'
	},
	{
		id: 'AC9TDI8P09',
		category: 'Processes and production skills',
		strand: 'Producing and implementing',
		subStrand: '',
		text: 'implement, modify and debug programs involving control structures and functions in a general-purpose programming language',
		code: 'AC9TDI8P09'
	},
	{
		id: 'AC9TDI8P10',
		category: 'Processes and production skills',
		strand: 'Evaluating',
		subStrand: '',
		text: 'evaluate existing and student solutions against the design criteria, user stories and possible future impact',
		code: 'AC9TDI8P10'
	},
	{
		id: 'AC9TDI8P11',
		category: 'Processes and production skills',
		strand: 'Collaborating and managing',
		subStrand: '',
		text: 'select and use a range of digital tools efficiently, including unfamiliar features, to create, locate and communicate content, consistently applying common conventions',
		code: 'AC9TDI8P11'
	},
	{
		id: 'AC9TDI8P12',
		category: 'Processes and production skills',
		strand: 'Collaborating and managing',
		subStrand: '',
		text: 'select and use a range of digital tools efficiently and responsibly to share content online, and plan and manage individual and collaborative agile projects',
		code: 'AC9TDI8P12'
	},
	{
		id: 'AC9TDI8P13',
		category: 'Processes and production skills',
		strand: 'Privacy and security',
		subStrand: '',
		text: 'explain how multi-factor authentication protects an account when the password is compromised and identify phishing and other cyber security threats',
		code: 'AC9TDI8P13'
	},
	{
		id: 'AC9TDI8P14',
		category: 'Processes and production skills',
		strand: 'Privacy and security',
		subStrand: '',
		text: 'investigate and manage the digital footprint existing systems and student solutions collect and assess if the data is essential to their purpose',
		code: 'AC9TDI8P14'
	}
];

const CONTENT_DESCRIPTORS_9_10_DESIGN: CurriculumContentDescriptor[] = [
	{
		id: 'AC9TDE10K01',
		category: 'Knowledge and understanding',
		strand: 'Technologies and society',
		subStrand: '',
		text: 'analyse how people in design and technologies occupations consider ethical, security and sustainability factors to innovate and improve products, services and environments',
		code: 'AC9TDE10K01'
	},
	{
		id: 'AC9TDE10K02',
		category: 'Knowledge and understanding',
		strand: 'Technologies and society',
		subStrand: '',
		text: 'analyse the impact of innovation, enterprise and emerging technologies on designed solutions for global preferred futures',
		code: 'AC9TDE10K02'
	},
	{
		id: 'AC9TDE10K03',
		category: 'Knowledge and understanding',
		strand: 'Technologies context: Engineering principles and systems',
		subStrand: '',
		text: 'analyse and make judgements on how the characteristics and properties of materials are combined with force, motion and energy to control engineered systems',
		code: 'AC9TDE10K03'
	},
	{
		id: 'AC9TDE10K04',
		category: 'Knowledge and understanding',
		strand: 'Technologies context: Food and fibre production',
		subStrand: '',
		text: 'analyse and make judgements on the ethical, secure and sustainable production and marketing of food and fibre enterprises',
		code: 'AC9TDE10K04'
	},
	{
		id: 'AC9TDE10K05',
		category: 'Knowledge and understanding',
		strand: 'Technologies context: Food specialisations',
		subStrand: '',
		text: 'analyse and make judgements on how the sensory and functional properties of food influence the design and preparation of sustainable food solutions for healthy eating',
		code: 'AC9TDE10K05'
	},
	{
		id: 'AC9TDE10K06',
		category: 'Knowledge and understanding',
		strand: 'Technologies context: Materials and technologies specialisations',
		subStrand: '',
		text: 'analyse and make judgements on how characteristics and properties of materials, systems, components, tools and equipment can be combined to create designed solutions',
		code: 'AC9TDE10K06'
	},
	{
		id: 'AC9TDE10P01',
		category: 'Processes and production skills',
		strand: 'Investigating and defining',
		subStrand: '',
		text: 'analyse needs or opportunities for designing; develop design briefs; and investigate, analyse and select materials, systems, components, tools and equipment to create designed solutions',
		code: 'AC9TDE10P01'
	},
	{
		id: 'AC9TDE10P02',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'apply innovation and enterprise skills to generate, test, iterate and communicate design ideas, processes and solutions, including using digital tools',
		code: 'AC9TDE10P02'
	},
	{
		id: 'AC9TDE10P03',
		category: 'Processes and production skills',
		strand: 'Producing and implementing',
		subStrand: '',
		text: 'select, justify, test and use suitable technologies, skills and processes, and apply safety procedures to safely make designed solutions',
		code: 'AC9TDE10P03'
	},
	{
		id: 'AC9TDE10P04',
		category: 'Processes and production skills',
		strand: 'Evaluating',
		subStrand: '',
		text: 'develop design criteria independently including sustainability to evaluate design ideas, processes and solutions',
		code: 'AC9TDE10P04'
	},
	{
		id: 'AC9TDE10P05',
		category: 'Processes and production skills',
		strand: 'Collaborating and managing',
		subStrand: '',
		text: 'develop project plans for intended purposes and audiences to individually and collaboratively manage projects, taking into consideration time, cost, risk, processes and production of designed solutions',
		code: 'AC9TDE10P05'
	}
];

const CONTENT_DESCRIPTORS_9_10_DT: CurriculumContentDescriptor[] = [
	{
		id: 'AC9TDI10K01',
		category: 'Knowledge and understanding',
		strand: 'Digital systems',
		subStrand: '',
		text: 'investigate how hardware and software manage, control and secure access to data in networked digital systems',
		code: 'AC9TDI10K01'
	},
	{
		id: 'AC9TDI10K02',
		category: 'Knowledge and understanding',
		strand: 'Data representation',
		subStrand: '',
		text: 'represent documents online as content (text), structure (markup) and presentation (styling) and explain why such representations are important',
		code: 'AC9TDI10K02'
	},
	{
		id: 'AC9TDI10K03',
		category: 'Knowledge and understanding',
		strand: 'Data representation',
		subStrand: '',
		text: 'investigate simple data compression techniques',
		code: 'AC9TDI10K03'
	},
	{
		id: 'AC9TDI10P01',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'develop techniques to acquire, store and validate data from a range of sources using software, including spreadsheets and databases',
		code: 'AC9TDI10P01'
	},
	{
		id: 'AC9TDI10P02',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'analyse and visualise data interactively using a range of software, including spreadsheets and databases, to draw conclusions and make predictions by identifying trends and outliers',
		code: 'AC9TDI10P02'
	},
	{
		id: 'AC9TDI10P03',
		category: 'Processes and production skills',
		strand: 'Acquiring, managing and analysing data',
		subStrand: '',
		text: 'model and query entities and their relationships using structured data',
		code: 'AC9TDI10P03'
	},
	{
		id: 'AC9TDI10P04',
		category: 'Processes and production skills',
		strand: 'Investigating and defining',
		subStrand: '',
		text: 'define and decompose real-world problems with design criteria and by interviewing stakeholders to create user stories',
		code: 'AC9TDI10P04'
	},
	{
		id: 'AC9TDI10P05',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'design algorithms involving logical operators and represent them as flowcharts and pseudocode',
		code: 'AC9TDI10P05'
	},
	{
		id: 'AC9TDI10P06',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'validate algorithms and programs by comparing their output against a range of test cases',
		code: 'AC9TDI10P06'
	},
	{
		id: 'AC9TDI10P07',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'design and prototype the user experience of a digital system',
		code: 'AC9TDI10P07'
	},
	{
		id: 'AC9TDI10P08',
		category: 'Processes and production skills',
		strand: 'Generating and designing',
		subStrand: '',
		text: 'generate, modify, communicate and critically evaluate alternative designs',
		code: 'AC9TDI10P08'
	},
	{
		id: 'AC9TDI10P09',
		category: 'Processes and production skills',
		strand: 'Producing and implementing',
		subStrand: '',
		text: 'implement, modify and debug modular programs, applying selected algorithms and data structures, including in an object-oriented programming language',
		code: 'AC9TDI10P09'
	},
	{
		id: 'AC9TDI10P10',
		category: 'Processes and production skills',
		strand: 'Evaluating',
		subStrand: '',
		text: 'evaluate existing and student solutions against the design criteria, user stories, possible future impact and opportunities for enterprise',
		code: 'AC9TDI10P10'
	},
	{
		id: 'AC9TDI10P11',
		category: 'Processes and production skills',
		strand: 'Collaborating and managing',
		subStrand: '',
		text: 'select and use emerging digital tools and advanced features to create and communicate interactive content for a diverse audience',
		code: 'AC9TDI10P11'
	},
	{
		id: 'AC9TDI10P12',
		category: 'Processes and production skills',
		strand: 'Collaborating and managing',
		subStrand: '',
		text: 'use simple project management tools to plan and manage individual and collaborative agile projects, accounting for risks and responsibilities',
		code: 'AC9TDI10P12'
	},
	{
		id: 'AC9TDI10P13',
		category: 'Processes and production skills',
		strand: 'Privacy and security',
		subStrand: '',
		text: 'develop cyber security threat models, and explore a software, user or software supply chain vulnerability',
		code: 'AC9TDI10P13'
	},
	{
		id: 'AC9TDI10P14',
		category: 'Processes and production skills',
		strand: 'Privacy and security',
		subStrand: '',
		text: 'apply the Australian Privacy Principles to critique and manage the digital footprint that existing systems and student solutions collect',
		code: 'AC9TDI10P14'
	}
];

const ENGINEERING_DESCRIPTOR_CODES = [
	'AC9TDE10K01',
	'AC9TDE10K02',
	'AC9TDE10K03',
	'AC9TDE10K06',
	'AC9TDE10P01',
	'AC9TDE10P02',
	'AC9TDE10P03',
	'AC9TDE10P04',
	'AC9TDE10P05',
	'AC9TDI10P01',
	'AC9TDI10P02',
	'AC9TDI10P04',
	'AC9TDI10P05',
	'AC9TDI10P06',
	'AC9TDI10P09',
	'AC9TDI10P11',
	'AC9TDI10P12'
] as const;

const CONTENT_DESCRIPTORS_10_ENGINEERING: CurriculumContentDescriptor[] = ENGINEERING_DESCRIPTOR_CODES.map(
	(code) => {
		const descriptor = [...CONTENT_DESCRIPTORS_9_10_DESIGN, ...CONTENT_DESCRIPTORS_9_10_DT].find(
			(item) => item.code === code
		);
		if (!descriptor) {
			throw new Error(`Missing engineering content descriptor: ${code}`);
		}
		return descriptor;
	}
);

export const QUICK_PLAN_TYPES: Record<QuickPlanType, CurriculumPlanType> = {
	'7-8-digital-technologies': {
		id: '7-8-digital-technologies',
		label: '7-8 Digital Technologies',
		levelDescription: LEVEL_DESCRIPTION_7_8_DT,
		contentDescriptors: CONTENT_DESCRIPTORS_7_8_DT
	},
	'9-10-design': {
		id: '9-10-design',
		label: '9-10 Design Technologies',
		levelDescription: LEVEL_DESCRIPTION_9_10_DESIGN,
		contentDescriptors: CONTENT_DESCRIPTORS_9_10_DESIGN
	},
	'9-10-digital-technologies': {
		id: '9-10-digital-technologies',
		label: '9-10 Digital Technologies',
		levelDescription: LEVEL_DESCRIPTION_9_10_DIGITAL,
		contentDescriptors: CONTENT_DESCRIPTORS_9_10_DT
	},
	'10-engineering': {
		id: '10-engineering',
		label: '10 Engineering',
		levelDescription: LEVEL_DESCRIPTION_10_ENGINEERING,
		contentDescriptors: CONTENT_DESCRIPTORS_10_ENGINEERING
	}
};

export const QUICK_PLAN_TYPE_LIST = Object.values(QUICK_PLAN_TYPES);

export function getCurriculumForPlanType(planType: QuickPlanType): CurriculumPlanType {
	return QUICK_PLAN_TYPES[planType];
}
